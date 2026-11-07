"""Build the editable offline review and six-page PDF from this versioned handoff.
Requires reportlab and Pillow. Does not access customer data, environment files or APIs.
"""
from pathlib import Path
import json, html, shutil
from xml.sax.saxutils import escape

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parents[2]
DATA=json.loads((ROOT/'content.zh-en.json').read_text())
TOKENS=json.loads((ROOT/'tokens.json').read_text())
META=DATA['meta']
BASE=META['sourceCommit']

def esc(x): return html.escape(str(x))

def build_html():
    images=[
      ('desktop-office-working-zh.png','工作中标识','桌面 1440 x 1000，phase 0。无脚底光圈，使用上方任务牌、工作条与动作。','wide'),
      ('desktop-relay-zh.png','双角色交接与六幕选择','真实浏览器截图，片段与交付文件同步。','wide'),
      ('desktop-service-flow-zh.png','完整 Free / Pro 服务路线','Free 先交报告，是否继续由用户决定。','wide'),
      ('desktop-team-zh.png','两列三行角色介绍','包含已同步的姓名悬停/当前角色下划线。','wide'),
      ('mobile-office-zh.png','手机上的工作状态','390 x 844 预设；地图可横向查看，角色保持足够大小。','phone'),
      ('mobile-relay-zh.png','手机交接 - 中文','发起者、文件、接收者竖向排列，人工决策单独成行。','phone'),
      ('mobile-relay-en.png','手机交接 - English','从实现导出的英文文案，不从截图反抄。','phone'),
      ('mobile-chapters-zh.png','手机六幕导航','三列两行；六位 Agent 介绍仍是两列三行。','phone'),
    ]
    gallery=''.join(f'<figure class="{kind}"><a href="screens/{file}" target="_blank"><img src="screens/{file}" alt="{esc(title)}"></a><figcaption><strong>{esc(title)}</strong><span>{esc(desc)}</span></figcaption></figure>' for file,title,desc,kind in images)
    roles=''.join(f'<tr><td>{esc(m["name"])}</td><td>{esc(m["room"])}</td><td>{esc(m["role"])}</td><td>{esc(m["output"])}</td></tr>' for m in DATA['locales']['zh']['members'])
    palette=''.join(f'<div class="swatch"><i style="background:{color}"></i><strong>{esc(name)}</strong><code>{color}</code></div>' for name,color in [('纸面','#fbfaf8'),('交接深绿','#243b2d'),('操作绿色','#456447'),('文件纸面','#fff7df'),('说明文字','#d5ddcc'),('工作条','#e6edc9')])
    docs=[('DESIGN-SPEC.md','设计规范'),('INTERACTION.md','交互与状态'),('IMPLEMENTATION.md','组件与素材'),('ACCEPTANCE.md','验收清单'),('content.zh-en.json','双语内容 JSON'),('tokens.json','样式令牌 JSON'),('states.json','合成状态示例'),('source-manifest.json','源码固定版本与校验')]
    links=''.join(f'<a href="{file}">{esc(label)}<span>{esc(file)}</span></a>' for file,label in docs)
    checks=['工作牌持续可见，桌面/脚底无光圈','六段片段和三段动作导航各自清楚','排队、运行、等待确认不混淆','暂停/后台/减少动态保留完整文字','中文和英文不截断关键任务信息','演示不调用模型或推进真实审批']
    check_html=''.join(f'<label><input type="checkbox">{esc(x)}</label>' for x in checks)
    script_data=json.dumps(DATA,ensure_ascii=False).replace('</','<\\/')
    page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>首客办公室 · UI/UX 设计交付</title>
<style>
:root{--paper:#fbfaf8;--paper2:#f7f5ef;--pine:#243b2d;--forest:#456447;--line:#d9d9cb;--text:#2a2f28;--muted:#5d6b5b;--serif:"Songti SC",STSong,Georgia,serif;--sans:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--text);font:16px/1.8 var(--sans)}::selection{background:#c8d2ba;color:var(--pine)}a{color:var(--forest);text-underline-offset:4px}button,select,input{font:inherit;accent-color:var(--forest)}a:focus-visible,button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--forest);outline-offset:4px}main{max-width:1160px;margin:auto;padding:48px 28px 80px}h1,h2,h3{font-family:var(--serif);font-weight:500;line-height:1.4;text-wrap:balance;color:var(--pine)}h1{font-size:clamp(32px,5vw,52px);margin:0 0 20px}h2{font-size:30px;margin:0 0 18px}h3{font-size:23px}p{max-width:74ch;text-wrap:pretty}header{padding:0 0 36px;border-bottom:1px solid var(--line)}.meta{color:var(--muted);font-size:14px}.actions,nav{display:flex;gap:12px;flex-wrap:wrap}.actions a{padding:10px 16px;border-radius:6px;background:var(--pine);color:var(--paper);text-decoration:none}nav{padding-top:20px;font-size:14px}section{padding-top:56px;scroll-margin-top:24px}.lede{font-size:18px;line-height:1.9}.scope{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}.scope p{font-size:15px}.scope strong{display:block;color:var(--pine);font-size:17px}.gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}figure{margin:0;padding:0;border-bottom:1px solid var(--line)}figure img{display:block;width:100%;height:auto;background:var(--paper2);border-radius:8px}.phone img{height:580px;object-fit:contain}.wide img{height:390px;object-fit:contain}figcaption{padding:14px 0 20px}figcaption strong{display:block;font-size:17px}figcaption span{display:block;color:var(--muted);font-size:14px;margin-top:4px}.storyboard{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.storyboard img{height:auto}.storyboard figcaption{font-size:14px}.note{padding:18px 22px;background:var(--paper2);border-radius:8px;border:1px solid var(--line);font-size:15px}.table-scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid var(--line);padding:12px 10px}th{color:var(--pine);font-weight:650;background:var(--paper2)}.palette{display:grid;grid-template-columns:repeat(6,1fr);gap:16px}.swatch i{display:block;height:64px;border:1px solid var(--line);border-radius:6px}.swatch strong,.swatch code{display:block;font-size:13px;margin-top:6px}.links{display:grid;grid-template-columns:repeat(2,1fr);gap:10px 28px}.links a{padding:12px 0;border-bottom:1px solid var(--line);font-weight:600;text-decoration:none}.links span{display:block;color:var(--muted);font-size:13px;font-weight:400}.checklist{display:grid;gap:10px}.checklist label{display:flex;gap:10px;align-items:start;font-size:15px}.checklist input{margin-top:9px}.review-controls{display:flex;gap:14px;flex-wrap:wrap;margin:20px 0}.review-controls label{font-size:14px}.review-controls select{padding:8px;border:1px solid var(--line);border-radius:6px;background:var(--paper)}.review-card{display:grid;grid-template-columns:1fr 150px 1fr;gap:24px;background:var(--pine);color:#fff9e9;border-radius:12px;padding:28px}.review-card h3{color:inherit;margin:0 0 8px}.review-card p{font-size:15px}.review-artifact{align-self:center;background:#fff7df;color:var(--pine);padding:22px 12px;border-radius:3px 12px 3px 3px;text-align:center}.review-card small{color:#d5ddcc}.review-action{margin-top:0;padding:18px 24px;background:var(--paper2);border-radius:0 0 8px 8px;font-size:15px}footer{padding-top:40px;margin-top:56px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}code{overflow-wrap:anywhere}summary{cursor:pointer;color:var(--forest)}pre{white-space:pre-wrap;word-break:break-word;padding:20px;background:var(--paper2);font-size:12px;max-height:380px;overflow:auto}
@media(max-width:700px){main{padding:28px 18px 60px}.scope,.gallery,.links{grid-template-columns:1fr}.palette{grid-template-columns:repeat(3,1fr)}.storyboard{grid-template-columns:1fr}.wide img{height:auto}.phone img{max-height:660px;height:auto}.review-card{grid-template-columns:1fr}.review-artifact{max-width:240px}.storyboard img{width:100%}h2{font-size:26px}}
@media print{nav,.actions,.review-controls{display:none}main{padding:0}section{break-inside:avoid}.wide img,.phone img{height:auto;max-height:380px}}
</style><main><header><h1>首客办公室<br>UI/UX 设计交付</h1><p class="lede">从“谁在工作”，到“成果交给谁”，让办公室自己把流程说清楚。</p><p class="meta">2026-11-08 · Asia/Shanghai · 快照基准 <code>__BASE__</code><br>核心视觉提交 fe432a3，包含姓名悬停动效与 d2c09c9 的交接列宽调整。</p><div class="actions"><a href="FirstCustomer-Office-UIUX-Handoff.pdf">阅读六页 PDF</a><a href="README.md">交接说明</a><a href="https://hifirst.vercel.app/#office" target="_blank" rel="noreferrer">线上办公室</a></div><nav aria-label="交付目录"><a href="#overview">改动范围</a><a href="#screens">实际效果</a><a href="#motion">动效分镜</a><a href="#copy">双语文案</a><a href="#system">设计参数</a><a href="#files">开发文件</a><a href="#acceptance">验收</a></nav></header>
<section id="overview"><h2>这次确定的表现</h2><div class="scope"><p><strong>工作状态在上方表达</strong>取消桌面/脚底光圈；任务牌、三条工作条、动物头部/手部动作和职责工具共同表达当前任务。</p><p><strong>交付物成为链路中心</strong>左右角色、中间文件和方向线，让人看清发起者、产物、接收者；人工确认单独说明。</p><p><strong>按角色理解服务路线</strong>六幕动物导航与两列三行角色说明相连。Free 起点与可选 Pro 路线分开，关键决策继续由人确认。</p></div></section>
<section id="screens"><h2>实际浏览器效果</h2><p>以下均来自交接基准的实际页面，点击可看原尺寸。手机截图保留周边上下文，测量请使用 CSS 和采集元数据。</p><div class="gallery">__GALLERY__</div></section>
<section id="motion"><h2>一幕内的三张关键分镜</h2><p>20 秒一幕：0-4 秒处理，4-8 秒送件，8-8.7 秒核对，8.7-10.5 秒交付，10.5-13 秒返回，13-20 秒接手开工。</p><div class="storyboard"><figure><img src="screens/desktop-office-working-zh.png" alt="Lumi 处理任务"><figcaption>01 / 工作中：上方任务牌与工作条</figcaption></figure><figure><img src="screens/desktop-office-handoff-zh.png" alt="Lumi 向 Nori 当面交接"><figcaption>02 / 当面核对：标题错层与文件交接</figcaption></figure><figure><img src="screens/desktop-office-next-working-zh.png" alt="Nori 回到工位继续工作"><figcaption>03 / 接手开工：让下一位的工作可见</figcaption></figure></div><p class="note">这里是机制演示。真实项目状态由保存的任务、审批与订单记录计算；本演示不调用模型，不确认付款，不推进发布。暂停、离屏、后台和减少动态路径保留文字内容。</p></section>
<section id="copy"><h2>审阅双语文案与角色分工</h2><p>下面的审阅器只切换包内静态内容；实际动画查看线上页面或源码。完整文案来自 <a href="content.zh-en.json">实现导出的 JSON</a>。</p><div class="review-controls"><label>语言 <select id="review-locale"><option value="zh">中文</option><option value="en">English</option></select></label><label>协作片段 <select id="review-scene"></select></label></div><div class="review-card"><div><h3 id="from-name"></h3><small id="from-room"></small><p id="from-line"></p></div><div class="review-artifact" id="artifact"></div><div><h3 id="to-name"></h3><small id="to-room"></small><p id="to-line"></p></div></div><p class="review-action" id="review-action"></p><div class="table-scroll"><table><thead><tr><th>角色</th><th>工位</th><th>职责</th><th>产物</th></tr></thead><tbody>__ROLES__</tbody></table></div><p>Toby 托比：老板形象，负责关键审批；Yuki 云团：绵羊 COO，负责站会与经营复盘。</p></section>
<section id="system"><h2>原有品牌中的清晰层级</h2><div class="palette">__PALETTE__</div><p>交接标题 25-36px，手机 24px；姓名 25px；对白 16px / 1.9；决策说明 15px / 1.85。沿用现有衬线与 sans 字体栈，不新增字体下载。</p><p>600px 以下交接改为竖向、片段导航为三列两行；六位 Agent 介绍保持两列三行。首页画布最小宽 760px，真实项目地图最小宽 680px，手机通过横向查看和镜头跟随保证角色大小。</p><p class="note">已记录的后续项：320px 英文首屏 CTA 会造成整页横向溢出；办公室交接组件自身没有溢出。详见验收清单，不能将组件走查等同全站已适配。</p></section>
<section id="files"><h2>前端可以直接对接的文件</h2><div class="links">__LINKS__</div><p>包内 <code>source/</code> 为 18 份源码摘录，完整工程以原仓库固定提交为准。<code>assets/</code> 提供背景、动作图集和角色插画图集。图集索引与工位坐标在 tokens.json 中，两个图集不要混用索引。</p><details><summary>查看版本说明</summary><pre>__META__</pre></details></section>
<section id="acceptance"><h2>先走查，再签收</h2><div class="checklist">__CHECKS__</div><p><a href="ACCEPTANCE.md">打开完整验收单与接收记录</a>。本页勾选仅用于当前浏览器查看，不上传，不代表团队已经签收。</p></section><footer>首客 HiFirst · 本包无环境变量、API Key 或真实客户记录。HTML / Markdown / JSON / 源码可编辑；可编辑源包括 HTML、Markdown、JSON 与 TSX/CSS；PDF 和截图用于评审。若后续 main 更新，本快照不会自动变更。</footer></main>
<script id="handoff-data" type="application/json">__DATA__</script><script>
const data=JSON.parse(document.getElementById('handoff-data').textContent), locale=document.getElementById('review-locale'), scene=document.getElementById('review-scene');
function show(reset){const d=data.locales[locale.value];if(reset){const old=scene.value;scene.replaceChildren(...d.scenes.map((s,i)=>{const o=document.createElement('option');o.value=i;o.textContent=String(i+1).padStart(2,'0')+' '+s.chapter;return o}));scene.value=old||'0'}const s=d.scenes[Number(scene.value)],from=d.members.find(m=>m.key===s.from),to=d.members.find(m=>m.key===s.to);for(const [id,value] of Object.entries({'from-name':from.name,'from-room':from.room,'from-line':s.lines[0],'to-name':to.name,'to-room':to.room,'to-line':s.lines[1],'artifact':s.document,'review-action':s.action}))document.getElementById(id).textContent=value;}
locale.addEventListener('change',()=>show(true));scene.addEventListener('change',()=>show(false));show(true);
</script></html>'''
    for key,value in {'__BASE__':BASE[:7],'__GALLERY__':gallery,'__ROLES__':roles,'__PALETTE__':palette,'__LINKS__':links,'__META__':esc(json.dumps(META,ensure_ascii=False,indent=2)),'__CHECKS__':check_html,'__DATA__':script_data}.items(): page=page.replace(key,value)
    (ROOT/'index.html').write_text(page)


def build_pdf():
    from reportlab.pdfgen import canvas
    from reportlab.lib.colors import HexColor
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import Paragraph
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfbase.cidfonts import UnicodeCIDFont
    from PIL import Image
    font_path=Path('/System/Library/Fonts/STHeiti Light.ttc')
    if font_path.exists(): pdfmetrics.registerFont(TTFont('HandoffCJK',str(font_path),subfontIndex=0));font='HandoffCJK'
    else: pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'));font='STSong-Light'
    build_root=REPO/'firstcustomer' if (REPO/'firstcustomer/package.json').is_file() else ROOT
    out=build_root/'output/pdf/FirstCustomer-Office-UIUX-Handoff.pdf';out.parent.mkdir(parents=True,exist_ok=True)
    c=canvas.Canvas(str(out),pagesize=A4,pageCompression=1)
    c.setTitle('首客办公室 UI/UX 设计交付 - 2026-11-08');c.setAuthor('HiFirst design handoff')
    W,H=A4; M=42;CW=W-2*M;pine=HexColor('#243b2d');muted=HexColor('#5d6b5b');rule=HexColor('#d9d9cb');paper=HexColor('#fbfaf8')
    def p(text,x,y,width,size=10.8,color=pine,leading=None):
        st=ParagraphStyle('body',fontName=font,fontSize=size,leading=leading or size*1.65,textColor=color,wordWrap='CJK',spaceBefore=0,spaceAfter=0)
        obj=Paragraph(escape(text).replace('\n','<br/>'),st);_,height=obj.wrap(width,H);obj.drawOn(c,x,y-height)
        assert y-height>=(16 if y<36 else 48), f'Overflow on page {c.getPageNumber()}: {text[:40]}'
        return y-height
    def page(title,subtitle):
        c.setFillColor(paper);c.rect(0,0,W,H,fill=1,stroke=0)
        c.setFillColor(pine);c.rect(M,H-39,32,3,fill=1,stroke=0)
        p(title,M,H-57,CW,23,leading=31)
        p(subtitle,M,H-98,CW,9.2,muted,14)
        c.setStrokeColor(rule);c.line(M,36,W-M,36)
        p(f'HiFirst / UI·UX handoff / {BASE[:7]}',M,28,CW-50,8,muted,10)
        c.setFont(font,8);c.setFillColor(muted);c.drawRightString(W-M,18,f'{c.getPageNumber()} / 6')
    def img(file,x,y,width,max_height=None):
        im=Image.open(ROOT/'screens'/file);height=width*im.height/im.width
        if max_height and height>max_height: width*=max_height/height;height=max_height
        c.drawImage(str(ROOT/'screens'/file),x,y-height,width,height,mask='auto')
        return y-height
    def bullet(text,y): return p('- '+text,M,y,CW,10.8)-8
    def table(rows,widths,y,row_min=25,size=9.5):
        x=M
        for ri,row in enumerate(rows):
            heights=[]
            for text,width in zip(row,widths):
                st=ParagraphStyle('cell',fontName=font,fontSize=size,leading=size*1.5,textColor=pine,wordWrap='CJK')
                q=Paragraph(escape(str(text)),st);_,hh=q.wrap(width-14,H);heights.append(hh)
            rh=max(row_min,max(heights)+14)
            if ri==0:c.setFillColor(HexColor('#e8efdf'));c.rect(M,y-rh,CW,rh,fill=1,stroke=0)
            x=M
            for text,width in zip(row,widths):p(str(text),x+7,y-7,width-14,size,leading=size*1.5);x+=width
            c.setStrokeColor(rule);c.line(M,y-rh,W-M,y-rh);y-=rh
        return y
    page('首客办公室 · 设计交付','2026-11-08 / Asia/Shanghai / 已实现页面的版本化快照')
    y=p('工作状态在上方表达，让交付物成为协作链路的中心。',M,H-137,CW,15,leading=24)-20
    y=img('desktop-office-working-zh.png',M,y,CW)-18
    for text in ['工作标识：取消桌面/脚底光圈，使用任务牌、动态工作条、动物动作和职责工具。','交接链路：左右角色与对白，中间文件与方向线，人工决策单独成行。','响应式：手机放大地图、竖向交接；六段导航三列两行，六位角色保持两列三行。']:
        y=bullet(text,y)
    y=p('交付包含：离线 HTML、规范、双语内容、状态示例、12 张截图、3 份原素材和 18 份源码摘录。',M,y-8,CW,10.5,muted)
    p('基准：d2c09c9；核心视觉：fe432a3；包含姓名悬停 d3e1684 和交接列宽调整 d2c09c9。',M,y-18,CW,9.5,muted)
    c.showPage()
    page('桌面交接 · 角色与成果','姓名、工位、对白、交付文件与用户决策分层表达')
    y=img('desktop-relay-zh.png',M,H-137,CW)-18
    for text in ['读图顺序：发起者 - 交付文件 - 接收者；底部说明需要用户确认的事。','主标题 25-36px；姓名 25px；对白 16px / 1.9；决策说明 15px / 1.85。','六位动物组成连续导航。选择片段会同步切换办公室、双方对白与文件；不是实际后台进度。']:
        y=bullet(text,y)
    c.showPage()
    page('移动端 · 先看清，再操作','390 x 844 预设；截图保留少量上下文，尺寸复核使用 CSS 与 capture-metadata.json')
    top=H-143; col=190; right=W-M-col
    bottom=img('mobile-office-zh.png',M,top,col)
    p('工作状态与控制区',M,bottom-9,col,9.2,muted)
    bottom=img('mobile-chapters-zh.png',M,bottom-34,col,max_height=220)
    p('片段导航：三列两行',M,bottom-8,col,9.2,muted)
    bottom2=img('mobile-relay-en.png',right,top,col,max_height=548)
    p('英文交接：发起者、文件、接收者竖向阅读。',right,bottom2-10,col,9.2,muted)
    p('角色介绍仍保持两列三行；桌面地图不缩成难辨认的小图。',right,bottom2-48,col,9.7,leading=16)
    c.showPage()
    page('动效分镜 · 一幕 20 秒','阶段可跳转；暂停、离屏、后台与减少动态保留文字，不推进业务')
    y=H-139
    story=[('desktop-office-working-zh.png','0-4000ms / 处理任务','Lumi 桌前工作，任务牌与工作条持续可见。'),('desktop-office-handoff-zh.png','8000-10500ms / 核对与交付','双方当面核对，标题错层；文件移交后显示接收。'),('desktop-office-next-working-zh.png','13000-20000ms / 接手开工','Nori 回到自己的工位继续工作，留七秒让用户看清。')]
    for file,title,desc in story:
        image_bottom=img(file,M,y,285)
        yy=p(title,M+305,y-4,CW-305,12,leading=19)
        p(desc,M+305,yy-12,CW-305,10.5,leading=18)
        y=image_bottom-25
    y=p('完整阶段：0-4s 处理 / 4-8s 送件 / 8-8.7s 核对 / 8.7-10.5s 移交 / 10.5-13s 返回 / 13-20s 接手。',M,y,CW,10.3,leading=17)-15
    p('运行约束：Canvas 30fps，DPR 上限 1.5。接收确认是演示动作，不是业务审批或实际到账确认。',M,y,CW,10.3,muted,17)
    c.showPage()
    page('设计参数 · 真实状态','沿用现有森林工作室视觉；精确令牌与合成状态见 JSON')
    y=H-143
    swatches=[('#fbfaf8','纸面'),('#243b2d','深松绿'),('#456447','操作绿'),('#fff7df','文件纸'),('#d5ddcc','深底说明'),('#e6edc9','工作条')]
    gap=10;ww=(CW-5*gap)/6
    for i,(value,label) in enumerate(swatches):
        xx=M+i*(ww+gap);c.setFillColor(HexColor(value));c.setStrokeColor(rule);c.roundRect(xx,y-35,ww,35,3,fill=1,stroke=1);p(label,xx,y-42,ww,8.8);p(value,xx,y-59,ww,8,muted)
    y-=98
    y=table([['排版/布局','实现值'],['交接标题','桌面 clamp(25px,2.9vw,36px)，手机 24px'],['对白 / 决策','16px / 1.9；15px / 1.85'],['移动断点','600px 以下竖向交接；导航三列两行'],['工作状态','上方任务牌与 900ms 三条工作条；没有脚底光圈'],['地图大小','首页最小宽 760px；真实项目最小宽 680px']],[130,CW-130],y,size=9.7)
    y-=22
    y=table([['真实状态','依据与表达'],['工作 / 排队','任务实际运行才显示工作中；尚未启动需明确排队。'],['等待 / 需操作','讲清等经营者、客户、到账或数据，并给正确入口。'],['暂停 / 收尾','暂停后不启动下一步；运行中任务可显示收尾后暂停。'],['失败 / 完成 / 结束','保留已保存材料；按真实结果恢复、交付或停止。']],[130,CW-130],y,size=9.7)
    p('states.json 全部是合成示例，没有客户数据。不要把动画或时长当作生产遥测。',M,y-20,CW,10,muted)
    c.showPage()
    page('交给前端 · 对接与验收','HTML / Markdown / JSON / 源码可编辑；PDF 和截图用于评审')
    y=table([['模块','源文件'],['场景与动作','office-showcase.tsx / office-showcase-canvas.ts'],['交接与服务路线','office-relay.tsx / service-journey.tsx / office-portrait.tsx'],['真实状态','office-guide.ts / office-stage.tsx / office-work-guide.tsx'],['样式','office-relay.css / office-showcase.css / admin/office.css'],['内容与素材','content.zh-en.json / tokens.json / states.json / assets/']],[118,CW-118],H-140,size=9.5)
    y-=20
    for text in ['首轮走查：确认动物、岗位、产物与双方交接一致；六位角色布局仍为两列三行。','交互：六幕选择与三个动作阶段可用；暂停/跟随/中英文切换正常。','业务：排队与等待确认不冒充工作中；演示不产生模型调用或审批记录。','证据：fe432a3 的 187 项测试、类型检查、lint 与构建通过；本次交付只增加文档与快照。']:
        y=bullet(text,y)
    y=p('已知后续项：320px 英文首屏 CTA 造成整页横向溢出，办公室组件自身没有溢出。系统级减少动态和读屏仍建议在目标设备人工复核。',M,y-6,CW,10.2,muted,17)-16
    p('接收：UI/UX ________  前端 ________  日期 ________\n打开 index.html 浏览；以 source-manifest.json 的固定提交链接对接完整工程。',M,y,CW,10.6,leading=19)
    c.save();shutil.copy2(out,ROOT/out.name)
    print('PDF created:',out,'and mirrored into handoff directory')

if __name__=='__main__':
    build_html();build_pdf()
