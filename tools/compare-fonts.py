#!/usr/bin/env python3
"""Optional independent outline/metric comparison. Requires Node and fontTools.

Only aggregate diagnostics are written; no font bytes or outline files are emitted.
This is NOT pixel comparison, native GPU execution or full shaping conformance.
Example: python tools/compare-fonts.py /path/to/StaticFace.ttf --output report.json
"""
import argparse
import json
import subprocess
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen

class OutlinePen(BasePen):
    def __init__(self, glyph_set):
        super().__init__(glyph_set)
        self.segments = []
        self.start = self.current = None

    def _moveTo(self, point):
        self.start = self.current = point

    def _lineTo(self, point):
        if point != self.current:
            self.segments.append([0, *self.current, *point, 0, 0, 0, 0])
        self.current = point

    def _qCurveToOne(self, control, point):
        self.segments.append([1, *self.current, *control, *point, 0, 0])
        self.current = point

    def _curveToOne(self, a, b, point):
        self.segments.append([2, *self.current, *a, *b, *point])
        self.current = point

    def _closePath(self):
        self._lineTo(self.start)

    def _endPath(self):
        pass


def signed_area(segments):
    """Independent exact-polynomial integral 1/2 * (x dy - y dx)."""
    total = 0.0
    for segment in segments:
        kind = segment[0]
        p = [segment[1+i*2:3+i*2] for i in range(kind+2)]
        if kind == 0:
            c = [p[0], [p[1][j]-p[0][j] for j in range(2)]]
        elif kind == 1:
            c = [p[0], [2*(p[1][j]-p[0][j]) for j in range(2)],
                 [p[2][j]-2*p[1][j]+p[0][j] for j in range(2)]]
        else:
            c = [p[0], [3*(p[1][j]-p[0][j]) for j in range(2)],
                 [3*(p[2][j]-2*p[1][j]+p[0][j]) for j in range(2)],
                 [p[3][j]-3*p[2][j]+3*p[1][j]-p[0][j] for j in range(2)]]
        total += sum((a[0]*b[1]-a[1]*b[0])*k/(i+k)
                     for i,a in enumerate(c) for k,b in enumerate(c) if k > 0)/2
    return total


def compare(path, node):
    module = (Path(__file__).resolve().parent.parent/'src/text/opentype.js').as_uri()
    script = f'''import {{readFileSync}} from 'node:fs';
import {{parseOpenType}} from {json.dumps(module)};
const f=parseOpenType(readFileSync(process.argv[1]));
console.log(JSON.stringify({{family:f.family,cmap:[...f.cmap],glyphs:f.glyphs}}));'''
    process = subprocess.run([node,'--input-type=module','-e',script,str(path.resolve())],
                             check=True, capture_output=True, text=True, timeout=60)
    ours = json.loads(process.stdout)
    with TTFont(path) as font:
        order = font.getGlyphOrder()
        if len(order) != len(ours['glyphs']):
            raise ValueError(f'Glyph count mismatch for {path.name}')
        glyph_set = font.getGlyphSet()
        unit = 1/font['head'].unitsPerEm
        wrong = []
        max_area = max_advance = 0.0
        for i,g in enumerate(ours['glyphs']):
            pen = OutlinePen(glyph_set)
            glyph_set[order[i]].draw(pen)
            reference = [[s[0]]+[v*unit*(-1 if k%2==0 else 1)
                         for k,v in enumerate(s[1:],1)] for s in pen.segments]
            area_delta = abs(signed_area(reference)-signed_area(g['segments']))
            advance_delta = abs(g['advance']-font['hmtx'].metrics[order[i]][0]*unit)
            max_area, max_advance = max(max_area,area_delta), max(max_advance,advance_delta)
            if area_delta > 1e-8 or advance_delta > 1e-8:
                wrong.append({'id':i,'areaDeltaEm2':area_delta,'advanceDeltaEm':advance_delta})
        reference_cmap = {cp:font.getGlyphID(name) for cp,name in font.getBestCmap().items()
                          if font.getGlyphID(name)}
        ours_cmap = dict(ours['cmap'])
        cmap_wrong = [cp for cp in reference_cmap.keys() | ours_cmap.keys()
                      if reference_cmap.get(cp) != ours_cmap.get(cp)]
        return {'fontLabel':path.name,'family':ours['family'],'glyphCount':len(order),
                'mappedScalars':len(ours_cmap),'glyphMismatches':len(wrong),
                'cmapMismatches':len(cmap_wrong),'cmapComparison':'bidirectional',
                'maxSignedAreaDeltaEm2':max_area,'maxAdvanceDeltaEm':max_advance,
                'sampleMismatches':wrong[:5]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('fonts', nargs='+', type=Path)
    parser.add_argument('--node', default='node')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    try:
        results = [compare(path,args.node) for path in args.fonts]
        record = {'status':'PASS' if all(not r['glyphMismatches'] and not r['cmapMismatches'] for r in results) else 'FAIL',
                  'scope':'signed-area, horizontal advance and character-map aggregates only; not contour/pixel/shaping/GPU equivalence',
                  'results':results}
    except Exception as error:
        record = {'status':'FAIL','error':str(error)}
    rendered = json.dumps(record,indent=2)
    if args.output:
        args.output.write_text(rendered+'\n',encoding='utf-8')
    print(rendered)
    return 0 if record['status']=='PASS' else 1

if __name__ == '__main__':
    raise SystemExit(main())
