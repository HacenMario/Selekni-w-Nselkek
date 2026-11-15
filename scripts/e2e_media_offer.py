#!/usr/bin/env python3
"""E2E helper: create a test offer with 2 images + 1 video via the API (owner account)."""
import base64
import io
import json
import subprocess
import urllib.request

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
    with urllib.request.urlopen(r, timeout=60) as resp:
        return json.loads(resp.read().decode())


# 1. login owner
tok = req('/auth/login', {'email': 'mourad@test.dz', 'password': 'owner123'}, method='POST')['token']
print('owner token ok')

# 2. make 2 JPEG images (colorful, with shapes so they are visibly different)
from PIL import Image, ImageDraw

def make_img(color, idx):
    img = Image.new('RGB', (640, 480), color)
    d = ImageDraw.Draw(img)
    for i in range(6):
        d.ellipse([80 + i * 80, 120 + (i % 3) * 80, 160 + i * 80, 200 + (i % 3) * 80], fill=(255 - idx * 40, 255 - i * 20, 90))
    d.text((40, 30), f'PHOTO {idx}', fill='white')
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=85)
    return base64.b64encode(buf.getvalue()).decode()

imgs = [{'mime': 'image/jpeg', 'dataBase64': make_img((200, 60 + idx * 40, 30), idx)} for idx in range(1, 3)]
print('images generated:', len(imgs))

# 3. make a 2-second mp4 with ffmpeg
subprocess.run([
    'ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi',
    '-i', 'testsrc=duration=2:size=320x240:rate=15',
    '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '/tmp/e2e-video.mp4'
], check=True)
video_bytes = open('/tmp/e2e-video.mp4', 'rb').read()
print('video size:', len(video_bytes), 'bytes')

# 4. upload video (raw body, no size limit path)
vid = req('/media/video?mime=video/mp4', token=tok, method='POST', raw=video_bytes, content_type='video/mp4')
print('video uploaded gridId:', vid['gridId'], 'size:', vid['size'])

# 5. create offer with images + video
offer = req('/offers', {
    'title': 'نقل مكتب كامل إلى محل جديد بوسط المدينة',
    'description': 'نقل أثاث مكتب: 3 مكاتب، 5 كراسي، خزانة أرشيف وطابعة. يتطلب شاحنة صغيرة وشخصين للتحميل. العمل يوم السبت صباحاً.',
    'categoryKey': 'moving',
    'wilaya': '31 - Oran',
    'address': 'شارع الأمير عبد القادر، عمارة 12، وهران',
    'amountDA': 5000,
    'images': imgs,
    'videos': [{'gridId': vid['gridId'], 'mime': 'video/mp4'}],
}, token=tok, method='POST')
print('offer created:', offer['_id'], 'images:', len(offer.get('images', [])), 'videos:', len(offer.get('videos', [])))

# 6. verify image serving + video streaming endpoints
oid = offer['_id']
img_id = offer['images'][0]['_id']
grid = offer['videos'][0]['gridId']
img_head = urllib.request.Request(f'{API}/images/{oid}/{img_id}', headers={'Authorization': f'Bearer {tok}'})
with urllib.request.urlopen(img_head, timeout=30) as r:
    print('image endpoint:', r.status, r.headers['Content-Type'], len(r.read()), 'bytes')
vid_head = urllib.request.Request(f'{API}/media/video/{oid}/{grid}', headers={'Authorization': f'Bearer {tok}'})
with urllib.request.urlopen(vid_head, timeout=60) as r:
    print('video endpoint:', r.status, r.headers['Content-Type'], 'accept-ranges:', r.headers.get('Accept-Ranges'))
# range request (seek)
rng = urllib.request.Request(f'{API}/media/video/{oid}/{grid}', headers={'Authorization': f'Bearer {tok}', 'Range': 'bytes=0-1023'})
with urllib.request.urlopen(rng, timeout=60) as r:
    print('video range:', r.status, 'content-range:', r.headers.get('Content-Range'))

# 7. second offer for filter testing (different wilaya + amount)
offer2 = req('/offers', {
    'title': 'مساعدة في نقل أغراض شقة صغيرة داخل نفس الحي',
    'description': 'نقل صناديق كرتون وغسالة من الطابق الأول إلى سيارة. شخص واحد يكفي، العمل أقل من ساعتين.',
    'categoryKey': 'moving',
    'wilaya': '16 - Alger',
    'address': 'حي البدر، الجزائر الوسطى',
    'amountDA': 1200,
}, token=tok, method='POST')
print('offer2 created:', offer2['_id'], 'amount:', offer2['amountDA'])
