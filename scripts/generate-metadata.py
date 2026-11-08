"""Deterministically extract structural metadata; retain the original Tanzil file."""
from pathlib import Path
import json
import xml.etree.ElementTree as ET
root = ET.parse('src/data/quran-data.xml').getroot()
surahs = [{'number': int(x.attrib['index']), 'name': x.attrib['tname'], 'arabic': x.attrib['name'], 'english': x.attrib['ename'], 'ayahs': int(x.attrib['ayas']), 'offset': int(x.attrib['start'])} for x in root.find('suras')]
def boundaries(name):
    return [{'number': int(x.attrib['index']), 'surah': int(x.attrib['sura']), 'ayah': int(x.attrib['aya'])} for x in root.find(name)]
data = {'surahs':surahs, 'juz':boundaries('juzs'), 'pages':boundaries('pages')}
assert len(surahs) == 114 and sum(s['ayahs'] for s in surahs) == 6236
assert len(data['juz']) == 30 and len(data['pages']) == 604
Path('src/data/quran.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
print('Verified 114 Surahs, 6,236 ayahs, 30 Juz boundaries, 604 Medina Mushaf pages.')
