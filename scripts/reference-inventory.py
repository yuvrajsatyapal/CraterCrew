"""Extract source icon inventory, without copying the blog's descriptions."""
from html.parser import HTMLParser
from pathlib import Path
import json

class Icons(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
    def handle_starttag(self, tag, attrs):
        if tag == 'img':
            attrs = dict(attrs)
            url = attrs.get('data-src', attrs.get('src', ''))
            if '/ico_' in url and url not in self.urls:
                self.urls.append(url)

parser = Icons()
parser.feed(Path('/tmp/cratercrew-blog.html').read_text())
names = '''Danger Rope|Upheaval|Topsy-Turvy|Displacer Beam|Earthquake|Gamma Goo|Concrete|Barrier-Be-Gone|Strip Mine|Sand Blast|Booster Worm|Spin Lasers|Mudrunner|Grenade Towers|Chasm|Bungee Bomb|Nail Gun|Fling|Hover Blocks|Spark Storm|Laser Bots|Lava Flow|Fix-it Foam|Gravity Grenade|Turbo Cannon|Bombs Away|Boring Missiles|Crash Dive|Matter Blaster|Stomper|Dash|Mineshaft|Warp Missiles|Bump Rockets|Bungee Punch|Sticks & Stones|Coin Toss|Bombardment|Trench|Rebound Lasers|Ricochet Rifle|Bumper Bowling|Reflex Missile|Magnablobs|Retreat|Super Retreat|Rocket Launch|Firefight|Auto Turrets|Sinker|Spike Pit|Flash Flood|Vacuum Cannon|Foundation|Battery|Knockback|Electric Putty|Sparkatron|Rampart|Neutron Beam|Zap Stix|Wrecker|Wiggle Worm|Six Shooter|Howitzer|Sandstone|Flying Wall|Airburst|Flywheel|Backflip|Snow Cone|Icicles|Bridge|Steamroller|Puzzle Box|Bouncy Blocker|Evac|Sticker Shock|Barbed Wire'''.split('|')
assert len(names) == len(parser.urls), (len(names), len(parser.urls))
items = []
for index, (name, url) in enumerate(zip(names, parser.urls)):
    pack = 'Danger' if index < 5 else 'Gamma' if index < 10 else 'Booster' if index < 14 else 'Chasm' if index < 19 else 'Spark' if index < 24 else 'Turbo' if index < 29 else 'Stomper' if index < 34 else 'Twenty' if index < 54 else 'Battery' if index < 59 else 'Neutron' if index < 74 else 'Puzzle'
    slug = name.lower().replace(' & ', '-and-').replace(' ', '-')
    # Reference Airburst is unrelated to the existing Moon Rain algorithm.
    if slug == 'airburst': slug = 'reference-airburst'
    items.append(dict(id=slug, name=name, packs=[pack] + (['Booster'] if name == 'Concrete' else []), icon=f'/weapons/{slug}.png', iconSource=url, source='https://www.blitwise.com/mikes-dev-blog'))
Path('docs/weapon-study/sources.json').write_text(json.dumps(items, indent=2) + '\n')
print(f'Extracted {len(items)} unique source icons; Concrete deduplicated.')
