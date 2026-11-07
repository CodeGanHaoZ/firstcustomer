from pathlib import Path
import json, hashlib
from datetime import datetime
from zoneinfo import ZoneInfo
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT

BASE = Path(__file__).resolve().parent
ROOT = BASE.parent.parent
E = BASE / 'evidence'
tests = json.loads((E / 'vitest.json').read_text())
probes = json.loads((E / 'probes.json').read_text())
manifest = json.loads((E / 'code-manifest.json').read_text())
assert tests['success'] and tests['numPassedTests'] == 225 and tests['numPendingTests'] == 0
assert [p['result'] for p in probes['probes']] == ['failed', 'failed']
assert 'Compiled successfully' in (E / 'build.log').read_text()
now = datetime.now(ZoneInfo('Asia/Shanghai')).strftime('%Y-%m-%d %H:%M')

doc = Document()
sec = doc.sections[0]
sec.page_height, sec.page_width = Cm(29.7), Cm(21)
sec.top_margin, sec.bottom_margin = Cm(1.9), Cm(1.9)
sec.left_margin, sec.right_margin = Cm(2.1), Cm(2.1)
sec.footer_distance = Cm(0.8)
for name in ['Normal', 'Title', 'Subtitle', 'Heading 1', 'Heading 2', 'Heading 3']:
    s = doc.styles[name]
    s.font.name = 'Arial'
    s.font.color.rgb = RGBColor(0, 0, 0)
    fonts = s.element.get_or_add_rPr().rFonts
    for key in list(fonts.attrib):
        if 'Theme' in key: del fonts.attrib[key]
    fonts.set(qn('w:eastAsia'), 'Heiti SC')
    for border in s.element.findall('.//' + qn('w:pBdr')):
        border.getparent().remove(border)
    s.paragraph_format.space_after = Pt(6)
doc.styles['Normal'].font.size = Pt(10.5)
doc.styles['Normal'].paragraph_format.line_spacing = 1.16
doc.styles['Title'].font.size = Pt(23)
doc.styles['Title'].font.bold = True
doc.styles['Heading 1'].font.size = Pt(16)
doc.styles['Heading 1'].paragraph_format.space_before = Pt(0)
doc.styles['Heading 2'].font.size = Pt(12)
doc.styles['Heading 2'].paragraph_format.space_before = Pt(10)
doc.styles['Heading 2'].paragraph_format.space_after = Pt(5)

footer = sec.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
r = footer.add_run('首客产品质量检验报告  2026-11-08  |  ')
r.font.size = Pt(8)
field = OxmlElement('w:fldSimple'); field.set(qn('w:instr'), 'PAGE'); footer._p.append(field)
doc.core_properties.title = '首客产品质量检验报告'
doc.core_properties.subject = '八维可信性实际检查结果'
doc.core_properties.author = 'Codex'
doc.core_properties.keywords = '首客, 检验报告, 数据溯源, 软件质量'
md = []

def heading(text, level=1):
    doc.add_heading(text, level)
    md.append('#' * (level + 1) + ' ' + text + '\n')

def p(text, bold=False, small=False):
    para = doc.add_paragraph()
    run = para.add_run(text)
    run.bold = bold
    if small: run.font.size = Pt(9)
    md.append(text + '\n')
    return para

def table(headers, rows, widths):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    for col, width in zip(t.columns, widths): col.width = Cm(width)
    for i, h in enumerate(headers): t.rows[0].cells[i].text = h
    for row in rows:
        cells = t.add_row().cells
        for cell, value in zip(cells, row): cell.text = str(value)
    for ri, row in enumerate(t.rows):
        trpr = row._tr.get_or_add_trPr()
        no_split = OxmlElement('w:cantSplit'); trpr.append(no_split)
        if ri == 0:
            repeat = OxmlElement('w:tblHeader'); trpr.append(repeat)
        for ci, cell in enumerate(row.cells):
            cell.width = Cm(widths[ci])
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            tcpr = cell._tc.get_or_add_tcPr()
            margins = OxmlElement('w:tcMar')
            for edge in ['top', 'bottom', 'left', 'right']:
                e = OxmlElement('w:' + edge); e.set(qn('w:w'), '75' if edge in ['top','bottom'] else '95'); e.set(qn('w:type'), 'dxa'); margins.append(e)
            tcpr.append(margins)
            if ri == 0:
                shade = OxmlElement('w:shd'); shade.set(qn('w:fill'), 'ECEFF1'); tcpr.append(shade)
            for para in cell.paragraphs:
                para.paragraph_format.space_after = Pt(1)
                para.paragraph_format.line_spacing = 1.08
                for run in para.runs:
                    run.font.size = Pt(9)
                    run.font.bold = ri == 0
                    run.font.color.rgb = RGBColor(0,0,0)
    md.append('| ' + ' | '.join(headers) + ' |\n| ' + ' | '.join(['---']*len(headers)) + ' |')
    md.extend('| ' + ' | '.join(str(v).replace('\n','；') for v in row) + ' |' for row in rows)
    md.append('')
    doc.add_paragraph().paragraph_format.space_after = Pt(1)

def page(text):
    doc.add_page_break(); heading(text)

def section(title, result, observed, limit, evidence):
    heading(title, 2)
    p('检测结果  ' + result, bold=True)
    p(observed)
    p(limit)
    p('证据  ' + evidence, small=True)

def link(text, url):
    para = doc.add_paragraph()
    rel = para.part.relate_to(url, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', is_external=True)
    h = OxmlElement('w:hyperlink'); h.set(qn('r:id'), rel)
    r = OxmlElement('w:r'); pr = OxmlElement('w:rPr')
    size = OxmlElement('w:sz'); size.set(qn('w:val'), '18'); pr.append(size)
    r.append(pr); text_node = OxmlElement('w:t'); text_node.text = text; r.append(text_node); h.append(r); para._p.append(h)
    para.paragraph_format.space_after = Pt(4)
    md.append(f'[{text}]({url})\n')

doc.add_paragraph('首客产品质量检验报告', style='Title')
md.append('# 首客产品质量检验报告\n')
p('八维可信性检查及软件测试实测结果', bold=True)
p(f'报告编号 FC-QA-20261108-01    出具时间 {now} 北京时间', small=True)
p('检测对象：首客 HiFirst 当前本地工作区，含本轮新增来源快照、溯源记录及结论评价代码。执行方：Codex 自动检查与代码审阅。', small=True)
heading('总体结论')
p('现有实现通过了本轮 225 项程序回归测试，但尚不能判定已满足八维可信性验收要求。来源版本保留、引用范围隔离和评价状态拆分已有可复现的通过记录；语义支持关系与数值语境检查存在已复现的缺口。', bold=True)
p('本次另执行 2 项构造反例检查，2 项均未达到预期拦截要求。没有开展线上真实资料抽样、外部独立核查或生产运行测量，因此不出具产品事实准确率、商业判断准确率或生产可靠性合格结论。')
table(['维度', '本轮判定', '主要检测结果'], [
 ['W3C PROV 溯源', '部分通过', '新快照及引用链测试通过；历史缺链和完整过程留存仍有缺口'],
 ['ISO/IEC 25012 数据质量', '部分通过', '匹配及使用限制有测试；数值语境反例 P02 不通过'],
 ['独立第三方抽检', '未满足', '未开展，缺少核查方、抽样记录及外部结果'],
 ['RFC 3161 时间戳', '未满足', '无 TSA 令牌与验证记录；SHA-256 不替代可信时间戳'],
 ['Wang–Strong 适用性', '未满足', '缺少逐项条件比较与人工标注相关性实测'],
 ['Toulmin 论证', '部分通过', '已有理由与反证记录；矛盾声明反例 P01 不通过'],
 ['聚合效度与区分效度', '未满足', '无正式效度验证、原始事件归组与概念混淆矩阵'],
 ['GRADE 参考下的支持程度', '部分通过', '人工评价与摘录拆分测试通过；双人复核及校准未完成'],
], [4.5, 2.0, 10.3])
p('判定口径：部分通过表示部分工程检查有通过证据，但该维度整体要求尚未满足；未满足表示关键机制或实测证据缺失。未检验内容不按通过计。本报告不构成标准符合性认证或第三方审计。', small=True)

page('检验范围与运行结果')
p('环境：Node v26.0.0、npm 11.15.0、Vitest 5.1.0、Next.js 16.4.5。本地临时 PostgreSQL 执行数据库迁移与流程测试；来源和模型主要使用测试替身。没有对生产库应用本轮迁移，没有抽取真实客户项目作为统计样本。')
p('最终全量运行：2026-11-08 01:46:34 开始，耗时 6.01 秒；15 个文件，225 项通过，0 失败，0 跳过。这里的通过率仅针对固定程序用例，不能解释为真实业务准确率。', bold=True)
rows = [(Path(s['name']).name, len(s['assertionResults']), '通过') for s in tests['testResults']]
table(['测试文件', '用例数', '结果'], rows, [11.2, 2.4, 3.2])
table(['检查', '结果', '证据'], [
 ['TypeScript 类型检查', '通过', 'typecheck.log'],
 ['ESLint 静态检查', '通过', 'lint.log'],
 ['Next.js 生产构建', '通过', 'build.log'],
 ['专项构造反例', '2 项不通过', 'probes.json'],
], [6.5, 3.3, 7.0])
p('过程异常已留档：首次全量测试因新增测试与资料库测试使用同一数据库端口而超时，改用空闲端口后重跑通过；首次构建受另一个构建进程的锁阻塞，锁释放后重跑通过。这些首次运行不计作通过。最终构建出现本地队列区域默认值提示，未据此验证线上队列配置。', small=True)

page('维度一至四的检测结果')
section('一  W3C PROV 数据溯源', '部分通过',
 '实际通过：同一 URL 多次采集保留旧正文；新证据绑定指定来源版本；并发采集不串用正文；数据库拒绝覆盖快照、修改证据身份及伪造摘要；引用链限制跨项目和旧范围证据。研究、定位和页面声明能关联到证据、来源快照及处理任务。',
 '仍有缺口：历史缓存没有回填为旧快照，历史材料可能显示溯源不完整；未完成 PROV 格式导出与规范约束验证。任务已保存模型及提示模板摘要，但研究阶段每次调用的完整检索输入与全部中间处理过程未形成完整可回放记录。不能将当前内部链路称为 W3C PROV 合规认证。',
 'provenance.test.ts 的版本保留、并发、完整性、范围隔离和流程用例；source-versions.ts；provenance.ts；0012_evidence_provenance.sql。')
section('二  ISO IEC 25012 数据质量', '部分通过，发现缺口 Q02',
 '实际通过：摘录匹配、未匹配拒绝或转人工、过期检查、许可检查、项目隔离及发布前引用复查有程序测试；新增快照有内容摘要核对。',
 '实际不通过：专项 P02 中，竞品“每席每月 19 美元”被用于“本品收入增长 19%”，当前数字匹配函数没有报错。线上字段完整率、过期占比、人工抽检准确率均未测量；未完成 ISO/IEC 25012 全部特性的评价。',
 'domain.test.ts；provenance.test.ts；probes.json P02；domain/experiment.ts:62。')
section('三  独立第三方抽检', '未满足，未开展外部检验',
 '检查范围内有内部审批、操作记录和本轮自动测试，但没有独立外部核查方、预先确定的抽样总体与方法、实际抽样核查结果，以及外部复检记录。',
 '本报告由协助开发的 Codex 执行，不能作为未参与开发和生成流程的独立第三方抽检。没有第三方通过率可报告，内部测试数量不能替代这项证据。',
 '本地代码、数据结构及检验资料检查；本次执行方式和样本记录。')
section('四  RFC 3161 可信时间戳', '未满足，未开展凭证检验',
 '已确认：新增来源版本保存采集时间及 UTF-8 正文的 SHA-256 摘要，数据库篡改防护测试通过。',
 '检查范围内没有接入 TSA 的请求/响应、RFC 3161 令牌、签名和证书信任链验证结果。当前只能检查本地记录一致性，不能据此证明该内容在独立可信时间点已存在，更不能证明内容属实。',
 'source_versions 数据结构；source-versions.ts；0012_evidence_provenance.sql；未发现时间戳令牌或验证产物。')

page('维度五至八的检测结果')
section('五  Wang Strong 任务适用性', '未满足',
 '已确认：项目保存目标市场、阶段和需求范围；证据及研究结果保存类别、候选人群和理由，旧范围隔离已有程序测试。',
 '未实现完整的项目条件与证据适用条件逐项比较。未开展人群、市场、场景和时间相关性的独立人工标注测试，也没有误用率、不可判断率和测试集隔离记录。当前不能判定系统能可靠识别“真实但不适用”的材料。',
 'agents/schemas.ts；db/schema.ts；workflow.test.ts；未见相关性标注集和对应实测结果。')
section('六  Toulmin 论证检查', '部分通过，发现缺口 Q01',
 '已确认：研究与定位保存理由、未知项和反证回应；新结论记录关联支持引用或推理上下文，界面不会自动把上下文当成支持。',
 '实际不通过：专项 P01 中，原文明确表达“不愿付费”，相反的“愿意付费”声明仍通过当前结构检查。该检查没有验证语义蕴含或矛盾；本次未运行真实模型，也未执行关键证据移除或反证加入后的模型判断调整试验。人工审批存在，但本轮没有证明其能消除该错误。',
 'probes.json P01；domain/claims.ts:41；domain/counter.ts；workflow/provenance.ts。')
section('七  聚合效度与区分效度', '未满足',
 '已确认：痛点、定价、收入及信号存在分类；同一来源版本中的重复引用能够复用。',
 '同一原始事件在不同网站的转载尚无归组机制，缺少独立来源数与方法分布的可核查统计。没有购买意向、试用、购买、续费的盲标混淆矩阵，也未开展正式的多特质多方法或其他适用的构念效度研究。P01 同时暴露了语义层面区分付费态度的检查缺口。',
 'agents/tools.ts 的去重条件；domain/evidence.ts；db/schema.ts；probes.json P01。')
section('八  结论支持程度评价', '部分通过',
 '实际通过：摘录匹配不自动提升结论支持程度；新结论默认未评价；人工评价单独保存理由、审核者、规则版本和历史；已绑定证据撤回或过期会让旧评价失效，过期页面提交被拒绝。A–E 来源分类与结论评价分开。',
 '仍未完成双人独立评价、一致率统计和等级校准。新增关键反证的相关性识别及自动触发旧结论重评未完成；旧评价变化检测主要覆盖已绑定材料。本实现使用首客规则，不构成正式 GRADE 实施或认证；目前没有真实审核样本可验证评价质量。',
 'provenance.test.ts 的默认状态、评价历史、撤回/过期和旧表单用例；domain/provenance.ts；workflow/provenance.ts:104。')

page('已复现的不通过项')
p('以下为特意构造的反例，通过现有代码真实执行得到。它们不是客户样本，不涉及真实模型调用，也不能据此估算线上错误发生率。检测脚本与原始输出分别保存在 run-probes.ts 和 probes.json。')
heading('Q01  结构检查接受与原文相反的付费声明', 2)
p('检测位置：checkClaims；涉及 Toulmin 论证与概念区分。严重程度：高，指自动检查不足以阻止相反含义的对外事实声明。', small=True)
table(['项目', '内容'], [
 ['来源', 'I complain about meeting notes but I would never pay for another notes app.'],
 ['摘录', 'I would never pay for another notes app'],
 ['声明', 'Customers are willing to pay for our notes app'],
 ['预期', '识别来源与声明矛盾，或阻止将其作为已获支持的事实声明'],
 ['实测', 'verifyQuote 返回 verified；checkClaims 返回空 violations 数组'],
 ['结论', '自动结构检查未拦截，专项检查不通过；人工评价不在本次反例执行范围内'],
], [2.4,14.4])
heading('Q02  数字匹配未绑定主体和单位', 2)
p('检测位置：unsupportedFigures；涉及数据一致性与推理准确性。严重程度：高，指错误的价格、百分比或效果陈述可能通过该层数值检查。', small=True)
table(['项目', '内容'], [
 ['来源', 'A competitor charges $19 per seat per month.'],
 ['声明', 'Our product increased revenue by 19%.'],
 ['预期', '识别主体不同、价格与增长率不同，报告缺少依据'],
 ['实测', 'unsupportedFigures 返回空数组，未指出不受支持的数值'],
 ['结论', '数值相同被接受，专项检查不通过；不等于已经观察到线上发布事故'],
], [2.4,14.4])
p('未关闭事项：Q01、Q02 在出具报告时仍可复现。现有人工审批及“结论未评价”标识能提示审核需要，但本次没有证据证明实际人工审核已经拦截这些反例。报告不会将提示文案或审批入口视为修复完成。', bold=True)
p('其他未满足项是机制或验证证据缺失：外部独立抽检、可信时间戳、适用性评测、原始事件归组与效度研究、双人评价校准。它们不是本次回归测试中的失败用例，也不能因为回归全部通过而被记为合格。')

page('证据索引与报告边界')
p('代码基线为本地工作区，基准提交 ' + manifest['baseCommit'] + '，另含未提交修改。code-manifest.json 记录 ' + str(len(manifest['files'])) + ' 个相关文件的 SHA-256；仅检出该提交不能重现本轮全部变更。', small=True)
table(['证据', '文件', '用途'], [
 ['E01', 'vitest.json / tests.log', '最终 225 项测试的名称、状态与运行输出'],
 ['E02', 'probes.json / run-probes.ts', '两项专项反例的输入、预期和实测结果'],
 ['E03', 'typecheck.log / lint.log', '类型检查与静态检查'],
 ['E04', 'build.log', '最终构建通过记录'],
 ['E05', 'tests-initial-port-conflict.log', '首次测试超时记录及重跑背景'],
 ['E06', 'build-initial-lock.log', '首次构建锁阻塞记录'],
 ['E07', 'code-manifest.json', '检查代码文件及内容摘要'],
 ['E08', 'worktree-status.txt', '执行时工作区改动状态'],
], [1.4,8.0,7.4])
p('证据目录：reports/2026-11-08-quality-inspection/evidence/。代码主入口：firstcustomer/src/workflow/source-versions.ts、provenance.ts、src/domain/claims.ts、experiment.ts、src/db/schema.ts，以及 drizzle/0012_evidence_provenance.sql。', small=True)
heading('未检验的指标与软件性质', 2)
p('真实资料准确率、相关性判断准确率、字段完整率、线上过期比例、独立来源数、审核者一致率均未形成实测值。未开展生产可用性监测、并发压测、备份恢复演练、完整安全渗透测试、移动端真实浏览器验收或真实模型反事实评测。页面检查仅包括服务端渲染与文案断言，不替代真实浏览器测试。')
p('本轮验证了固定测试场景中的引用隔离、故障处理及相关流程。没有部署或生产数据库升级验证。部署前仍需应用本轮迁移并完成实际环境验收；报告结论仅适用于所记录的本地版本与测试范围。')
heading('判定参考资料', 2)
links = [
 ('W3C PROV 数据模型', 'https://www.w3.org/TR/prov-dm/'),
 ('ISO IEC 25012 数据质量模型', 'https://www.iso.org/standard/35736.html'),
 ('ISO IEC 25010 产品质量模型', 'https://www.iso.org/standard/78176.html'),
 ('RFC 3161 时间戳协议', 'https://www.rfc-editor.org/rfc/rfc3161.html'),
 ('Wang Strong 数据质量原始论文', 'https://web.mit.edu/tdqm/www/tdqmpub/beyondaccuracy_files/beyondaccuracy.html'),
 ('Toulmin The Uses of Argument', 'https://www.cambridge.org/core/books/the-uses-of-argument/26CF801BC12004587B66778297D5567C'),
 ('Campbell Fiske 聚合与区分效度原始论文', 'https://languagetesting.info/articles/store/C%26F1959.pdf'),
 ('GRADE 使用条件', 'https://gradeworkinggroup.org/docs/Criteria_for_using_GRADE_2016-04-05.pdf'),
]
for text, url in links: link(text, url)

# Pin CJK fonts on every run, including hyperlink and footer runs.
for root in [doc.element, sec.footer._element]:
    for run in root.iter(qn('w:r')):
        props = run.find(qn('w:rPr'))
        if props is None:
            props = OxmlElement('w:rPr'); run.insert(0, props)
        fonts = props.find(qn('w:rFonts'))
        if fonts is None:
            fonts = OxmlElement('w:rFonts'); props.insert(0, fonts)
        for key in list(fonts.attrib):
            if 'Theme' in key: del fonts.attrib[key]
        fonts.set(qn('w:ascii'), 'Arial')
        fonts.set(qn('w:hAnsi'), 'Arial')
        fonts.set(qn('w:eastAsia'), 'Heiti SC')

out = BASE / '首客产品质量检验报告_2026-11-08.docx'
doc.save(out)
(BASE / '首客产品质量检验报告_2026-11-08.md').write_text('\n'.join(md), encoding='utf-8')
print(out)
