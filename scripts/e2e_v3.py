#!/usr/bin/env python3
"""E2E v3: avatar persistence, chunked big video, notification read, admin powers, packages."""
import base64
import io
import json
import subprocess
import urllib.request
import urllib.error

API = 'http://localhost:3100/api'


def req(path, data=None, token=None, method='GET', raw=None, content_type='application/json'):
    url = f'{API}{path}'
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    body = None
    if raw is not None:
        body = raw
        headers['Content-Type'] = content_type
    elif data is not None:
        body = json.dumps(data).encode()
        headers['Content-Type'] = 'application/json'
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {'__http': e.code, **json.loads(e.read().decode() or '{}')}


# ---------- 1. avatar persistence ----------
from PIL import Image, ImageDraw

img = Image.new('RGB', (300, 300), (200, 80, 30))
d = ImageDraw.Draw(img)
d.ellipse([60, 60, 240, 240], fill=(255, 220, 120))
buf = io.BytesIO()
img.save(buf, 'JPEG', quality=80)
avatar_b64 = base64.b64encode(buf.getvalue()).decode()

r = req('/auth/login', {'email': 'walid@test.dz', 'password': 'secret123'}, method='POST')
if 'token' not in r:
    r = req('/auth/register', {
        'name': 'وليد الأفاتار', 'email': 'walid@test.dz', 'phone': '0999888777',
        'password': 'secret123', 'gender': 'male', 'age': 30, 'role': 'owner',
        'avatar': {'mime': 'image/jpeg', 'dataBase64': avatar_b64},
    })
    if 'token' not in r:  # exists already from a partial earlier run — refresh the avatar
        r = req('/auth/login', {'email': 'walid@test.dz', 'password': 'secret123'}, method='POST')
        req('/me', {'avatar': {'mime': 'image/jpeg', 'dataBase64': avatar_b64}}, token=r['token'], method='PATCH')
tok = r['token']
me1 = req('/me', token=tok)
print('1) avatar after register: hasAvatar =', me1.get('hasAvatar'))

# fresh fetch (what happens after a page refresh)
me2 = req('/me', token=req('/auth/login', {'email': 'walid@test.dz', 'password': 'secret123'}, method='POST')['token'])
print('   avatar after fresh /me: hasAvatar =', me2.get('hasAvatar'))
av = urllib.request.Request(f'{API}/images/avatar/{me2["_id"]}', headers={'Authorization': f'Bearer {tok}'})
with urllib.request.urlopen(av, timeout=15) as resp:
    print('   avatar endpoint:', resp.status, resp.headers['Content-Type'], len(resp.read()), 'bytes')

# update avatar via PATCH (ProfileScreen flow)
r2 = req('/me', {'avatar': {'mime': 'image/jpeg', 'dataBase64': avatar_b64}}, token=tok, method='PATCH')
print('   avatar after PATCH: hasAvatar =', r2.get('hasAvatar'))

# ---------- 2. chunked big video (~16MB) ----------
subprocess.run([
    'ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi',
    '-i', 'testsrc2=duration=25:size=640x480:rate=30',
    '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-b:v', '5M', '/tmp/big-video.mp4'
], check=True)
video = open('/tmp/big-video.mp4', 'rb').read()
print('2) big video size:', len(video), 'bytes =', round(len(video) / 1048576, 1), 'MB')

start = req('/media/video/start', token=tok, method='POST')
uid = start['uploadId']
CHUNK = 4 * 1024 * 1024
chunks = 0
for i in range(0, len(video), CHUNK):
    c = req(f'/media/video/chunk?uploadId={uid}', token=tok, method='POST', raw=video[i:i + CHUNK], content_type='application/octet-stream')
    chunks += 1 if c.get('ok') else 0
print('   chunks uploaded:', chunks)
fin = req(f'/media/video/finalize?uploadId={uid}&mime=video/mp4', token=tok, method='POST')
print('   finalize:', 'gridId' in fin, 'size =', fin.get('size'))

# attach to an offer
offer = req('/offers', {
    'title': 'تجربة فيديو كبير لحمل أثاث مكتب كامل',
    'description': 'عرض اختبار فيديو كبير الحجم للتحقق من الرفع المجزأ والبث مع دعم التمرير داخل المشغل.',
    'categoryKey': 'moving', 'wilaya': '31 - Oran', 'address': 'شارع الدكتور سيطي، وهران',
    'amountDA': 7000, 'videos': [{'gridId': fin['gridId'], 'mime': 'video/mp4'}],
}, token=tok, method='POST')
print('   offer with video:', '_id' in offer)
vid_url = f"{API}/media/video/{offer['_id']}/{fin['gridId']}"
vh = urllib.request.Request(vid_url, headers={'Authorization': f'Bearer {tok}'})
with urllib.request.urlopen(vh, timeout=60) as resp:
    print('   full stream:', resp.status, resp.headers['Content-Type'], len(resp.read()), 'bytes')
rng = urllib.request.Request(vid_url, headers={'Authorization': f'Bearer {tok}', 'Range': 'bytes=1048576-2097151'})
with urllib.request.urlopen(rng, timeout=60) as resp:
    print('   mid-file range:', resp.status, resp.headers.get('Content-Range'))

# ---------- 3. admin powers ----------
atok = req('/auth/login', {'email': 'admin@slekni.dz', 'password': 'SlekniAdmin#2026'}, method='POST')['token']
dash = req('/admin/dashboard', token=atok)
print('3) dashboard expiringSubs key:', 'expiringSubs' in dash, '| complaintsOpen:', dash.get('complaintsOpen'))

# targeted notify
uid_target = me2['_id']
n1 = req('/admin/notify', {'userId': uid_target, 'title': 'رسالة خاصة', 'body': 'مرحباً وليد، هذا إشعار موجّه إليك تحديداً.'}, token=atok, method='POST')
print('   targeted notify:', n1.get('notified'))
notifs = req('/notifications', token=tok)
first = notifs['items'][0]
print('   user got notif:', first['data'].get('title'), '| unread:', notifs['unreadCount'])
rd = req(f"/notifications/{first['_id']}/read", token=tok, method='POST')
notifs2 = req('/notifications', token=tok)
print('   after single read: unread =', notifs2['unreadCount'])

# user edit + delete
r3 = req('/auth/register', {'name': 'حساب مؤقت للحذف', 'email': 'temp-del@test.dz', 'phone': '0777000111', 'password': 'secret123', 'gender': 'female', 'age': 22, 'role': 'seeker'}, method='POST')
temp_id = r3['user']['_id']
pe = req(f'/admin/users/{temp_id}', {'name': 'حساب معدّل', 'phone': '0777000222', 'role': 'owner'}, token=atok, method='PATCH')
print('   admin edit user:', pe.get('name') == 'حساب معدّل', '| role =', pe.get('role'))
de = req(f'/admin/users/{temp_id}', token=atok, method='DELETE')
users_list = req('/admin/users', token=atok)
print('   admin delete user:', de.get('ok') is True, '| still listed:', any(u['_id'] == temp_id for u in users_list['items']))

# ---------- 4. packages ----------
st = req('/settings')
print('4) settings packages:', len(st.get('packages', [])), [p['key'] for p in st.get('packages', [])])
pk = req('/admin/settings', {'packages': st.get('packages', []) + [{'key': 'vip', 'name': {'ar': 'باقة VIP', 'fr': 'VIP', 'en': 'VIP'}, 'priceDA': 2500, 'durationDays': 180, 'maxActiveOffers': 30, 'active': True}]}, token=atok, method='PUT')
print('   added VIP package:', any(p['key'] == 'vip' for p in pk.get('packages', [])))

# owner subscribes to VIP
sub = req('/subscriptions', {'reference': 'TEST-REF-9911', 'packageKey': 'vip'}, token=tok, method='POST')
print('   subscribe VIP: amount =', sub.get('amountDA'), '| pkg =', sub.get('packageKey'))
mine = req('/subscriptions/mine', token=tok)
print('   packages in /mine:', [p['key'] for p in mine.get('packages', [])])

# admin approves → duration from package (180 days)
sid = sub['_id']
dec = req(f'/admin/subscriptions/{sid}/decide', {'action': 'approve'}, token=atok, method='POST')
days = (dec.get('endsAt') and int((dec['endsAt'][:19].replace('T', ' ').find('x') * 0)) ) if dec.get('endsAt') else None
from datetime import datetime
dd = (datetime.fromisoformat(dec['endsAt'].replace('Z', '')) - datetime.fromisoformat(dec['startsAt'].replace('Z', ''))).days if dec.get('endsAt') and dec.get('startsAt') else None
print('   approved: endsAt - startsAt =', dd, 'days (expect 180)')
dash2 = req('/admin/dashboard', token=atok)
print('   expiring subs now:', len(dash2.get('expiringSubs', [])))

print('ALL-E2E-DONE')
