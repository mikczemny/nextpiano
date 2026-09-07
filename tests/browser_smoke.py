"""Offline UI test using the real assets in an in-memory browser document.
The storage shim is only for about:blank; Android uses real localStorage.
"""
from pathlib import Path
import json, re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'app/src/main/assets'
def load(page, state=None):
    html=(ASSETS/'index.html').read_text()
    html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]+>', '', html)
    html=re.sub(r'<script[^>]*>.*?</script>', '', html)
    html=re.sub(r'<link[^>]+>', '', html)
    page.set_content(html)
    page.evaluate('''(initial) => {window.__store = initial || {};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.__store[k]||null,setItem:(k,v)=>{window.__store[k]=String(v)}}});}''',state or {})
    page.add_style_tag(content=(ASSETS/'styles.css').read_text())
    for name in ['theory.js','lessons.js','audio.js','app.js']:
        page.add_script_tag(content=(ASSETS/name).read_text())
    page.wait_for_timeout(150)
if __name__=='__main__':
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        errors=[]
        page=b.new_page(viewport={'width':1365,'height':1000})
        page.on('pageerror',lambda err:errors.append(str(err)))
        load(page)
        print(page.title(),errors,page.locator('.pkey').count())
        for view in ['studio','theory','ear','practice','metro','midi']:
            page.evaluate('(v)=>NextPiano.go(v)',view)
            assert page.locator('.card').count()>0,view
            print(view,'OK')
        assert not errors,errors
        b.close()
