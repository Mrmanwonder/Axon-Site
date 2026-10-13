"""Convert src/ui/styles/tokens.css into W3C DTCG design tokens (design-tokens/tokens.json).
Run from the repo root: python3 scripts/design-tokens/build-tokens.py
Default mode = dark theme / text size m; other modes live in $extensions["com.axon.modes"].
Values that are not plain DTCG (clamp/calc/env/color-mix) are kept as strings and printed."""
import re,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
src=(ROOT/'src/ui/styles/tokens.css').read_text()
src=re.sub(r'/\*.*?\*/','',src,flags=re.S)
# flatten media
blocks=[]
for m in re.finditer(r'@media\s*\(([^)]*)\)\s*\{\s*:root\s*\{([^}]*)\}\s*\}',src):
    blocks.append(('media '+m.group(1),m.group(2)))
src2=re.sub(r'@media[^{]*\{\s*:root\s*\{[^}]*\}\s*\}','',src)
for m in re.finditer(r'([^{}]+)\{([^}]*)\}',src2):
    blocks.append((' '.join(m.group(1).split()),m.group(2)))
def mode(sel):
    if sel.startswith('media'):return 'bp-'+re.search(r'(\d+)px',sel).group(1)
    if 'light' in sel:return 'light'
    if 'dark' in sel:return 'dark'
    t=re.search(r'data-text="(\w)"',sel)
    if t:return 'text-'+t.group(1)
    return 'base'
SURF={'bg','surface','surface-sunk','hairline','field','sheet-bg','scrim','card-shadow'}
PAL={'d':'dark','l':'light'}
def path(n):
    if n.startswith('p-'):
        p=n[2:].split('-')
        if p[0]=='cause':return 'palette.cause.'+'-'.join(p[1:])
        if p[-1] in PAL and len(p)==2:return f'palette.{p[0]}.{PAL[p[1]]}'
        if len(p)==1:return 'palette.'+p[0]
        return f'palette.{p[0]}.'+'-'.join(p[1:])
    if n in SURF:return 'surface.'+n
    for pre,g in [('r-','radius.'),('fs-','typography.fontSize.'),('ls-','typography.letterSpacing.'),('fw-','typography.fontWeight.'),('d-','motion.duration.')]:
        if n.startswith(pre):return g+n[len(pre):]
    if n.startswith('spring'):return 'motion.'+n
    if n.startswith('button-'):return 'component.button.'+n[7:]
    if n.startswith('nav-'):return 'component.nav.'+n[4:]
    if n.startswith('heat-'):return 'component.heat.'+n[5:]
    if n.startswith(('glass-','toast-')):a,b=n.split('-',1);return f'component.{a}.{b}'
    if n in('track-off','seg-on'):return 'component.control.'+n
    if n.startswith('focus-'):return 'component.focus.'+n[6:]
    if n in('top-inset','bot-inset','gutter','text-gutter','view-top','view-bottom','dock-pad','rail-w'):return 'layout.'+n
    if n in('m1','m5'):return 'role.map.'+n
    if n.startswith('cause-'):return 'role.cause.'+n[6:]
    if n in('label','label-2','label-3','statusfg'):return 'role.text.'+n
    return 'role.color.'+n
def ref(v):return re.sub(r'var\(--([\w-]+)\)',lambda m:'{'+path(m.group(1))+'}',v.strip())
CLEAN=re.compile(r'^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|-?[\d.]+(px|em|ms|s)?|\{[\w.-]+\}|cubic-bezier\([^)]*\))$')
notes=[]
def typed(p,v):
    if p.startswith('motion.spring-'):return 'number',float(v)
    if p=='motion.spring':return 'cubicBezier',[float(x) for x in re.findall(r'[\d.]+',v)]
    if 'fontWeight' in p:return 'fontWeight',int(v)
    if 'duration' in p:
        if v.endswith('ms'):return 'duration',{'value':float(v[:-2]),'unit':'ms'}
        return 'duration',{'value':round(float(v[:-1])*1000),'unit':'ms'}
    if 'shadow' in p and v=='none':
        notes.append(f'{p}: "none" kept as string');return 'shadow','none'
    if 'shadow' in p and not v.startswith('{'):
        out=[]
        for part in re.split(r',\s*(?![^()]*\))',v):
            nums=[x.replace('px','') for x in re.sub(r'rgba?\([^)]*\)','',part).split()];col=re.search(r'rgba?\([^)]*\)',part).group(0)
            out.append({'offsetX':nums[0]+'px','offsetY':nums[1]+'px','blur':nums[2]+'px','spread':'0px','color':col})
        return 'shadow',out
    if p=='component.focus.ring':
        return 'border',{'width':'2px','style':'solid','color':ref('var(--accent)')}
    t='color' if p.startswith(('palette','surface','role','component.button','component.nav','component.heat','component.glass','component.toast','component.control')) and 'shadow' not in p else ('dimension' if not p.startswith('typography.letterSpacing') else 'dimension')
    if not CLEAN.match(v) and v!='none':
        notes.append(f'{p}: "{v}" is not a plain DTCG {t} value (kept as string)')
    if v=='none':notes.append(f'{p}: "none" (no shadow) kept as string')
    return t,v
tree={};seen={}
def put(p,mode,v):
    seen.setdefault(p,{})[mode]=v
for sel,body in blocks:
    md=mode(sel)
    for n,v in re.findall(r'--([\w-]+)\s*:\s*([^;]+);',body):
        put(path(n),md,ref(v))
for p,modes in seen.items():
    base=modes.get('base',modes.get('dark'))
    t,val=typed(p,base)
    tok={'$type':t,'$value':val}
    ext={}
    for m,v in modes.items():
        if m in('base','dark') or v==base:continue
        ext[m]=typed(p,v)[1]
    if 'dark' in modes and 'light' not in modes and 'base' not in modes: pass
    if ext:tok['$extensions']={'com.axon.modes':ext}
    node=tree
    for k in p.split('.')[:-1]:node=node.setdefault(k,{})
    node[p.split('.')[-1]]=tok
tree['spacing']={'$description':'NEW — derived from literal padding/margin/gap px frequency (most common literal values across src/ui CSS); not in tokens.css',
 **{str(k):{'$type':'dimension','$value':f'{v}px'} for k,v in [('0-5',2),('1',4),('1-5',6),('2',8),('2-5',10),('3',12),('3-5',14),('4',16),('4-5',18),('5',20),('6',24),('8',32)]}}
tree['$description']='Axon design tokens converted from src/ui/styles/tokens.css. Layers: palette → surface/role → component. Default mode = dark (and base text size m); other modes in $extensions["com.axon.modes"] (light, text-s, text-m, text-l, bp-768, bp-1024).'
(ROOT/'design-tokens/tokens.json').write_text(json.dumps(tree,indent=2)+'\n')
print(len(seen),'tokens written to design-tokens/tokens.json')
print('\n'.join(sorted(set(n for n in notes if n))),file=sys.stderr)
