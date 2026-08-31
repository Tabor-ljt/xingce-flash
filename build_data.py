# -*- coding: utf-8 -*-
"""汇总 data/mod_*.json + data/id_*.json -> data/db.js（应用运行时数据）"""
import json, glob, os, sys, io, datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE, 'data')

MODULE_ORDER = ['politics', 'quant_data', 'judgment', 'verbal', 'commonsense']


def validate(card, ctx):
    errs = []
    for f in ('front', 'back', 'keywords', 'difficulty', 'source'):
        if f not in card:
            errs.append(f"{ctx}: 缺字段 {f}")
    if 'keywords' in card:
        if not isinstance(card['keywords'], list) or not (1 <= len(card['keywords']) <= 6):
            errs.append(f"{ctx}: keywords 数量异常")
    if 'difficulty' in card and card['difficulty'] not in (1, 2, 3):
        errs.append(f"{ctx}: difficulty 非法")
    if 'back' in card and len(card['back']) > 75:
        errs.append(f"{ctx}: back 超长({len(card['back'])}字)")
    for f in ('validUntil', 'examYear'):
        if f in card and not isinstance(card[f], str):
            errs.append(f"{ctx}: {f} 须为字符串")
    return errs


def validate_iq(item, ctx, topic_ids):
    errs = []
    for f in ('topicId', 'stem', 'options', 'answer', 'why', 'trap'):
        if f not in item:
            errs.append(f"{ctx}: 缺字段 {f}")
    if 'topicId' in item and item['topicId'] not in topic_ids:
        errs.append(f"{ctx}: topicId 不存在 -> {item['topicId']}")
    if 'options' in item:
        if not isinstance(item['options'], list) or len(item['options']) != 4:
            errs.append(f"{ctx}: options 必须恰好 4 个")
    if 'answer' in item and item['answer'] not in (0, 1, 2, 3):
        errs.append(f"{ctx}: answer 非法")
    if 'stem' in item and len(item['stem']) < 10:
        errs.append(f"{ctx}: stem 过短")
    return errs


def main():
    modules = []
    all_errs = []
    total_cards = 0
    files = {os.path.basename(p): p for p in glob.glob(os.path.join(DATA_DIR, 'mod_*.json'))}

    for mid in MODULE_ORDER:
        fname = f'mod_{mid}.json'
        if fname not in files:
            print(f"[缺失] {fname}")
            continue
        with open(files[fname], encoding='utf-8') as f:
            m = json.load(f)
        for t in m.get('topics', []):
            for i, c in enumerate(t.get('cards', [])):
                cid = f"{mid}-{t['id']}-{i}"
                ctx = f"{m['moduleId']}/{t['id']}/{i}"
                all_errs += validate(c, ctx)
                c['id'] = cid
                total_cards += 1
        modules.append(m)

    # 题眼识别训练题（id_*.json，挂载到对应模块）
    total_iq = 0
    id_files = {os.path.basename(p): p for p in glob.glob(os.path.join(DATA_DIR, 'id_*.json'))}
    for mid in MODULE_ORDER:
        fname = f'id_{mid}.json'
        if fname not in id_files:
            continue
        m = next((x for x in modules if x['moduleId'] == mid), None)
        if m is None:
            all_errs.append(f"{fname}: 对应模块不存在，已跳过")
            continue
        with open(id_files[fname], encoding='utf-8') as f:
            d = json.load(f)
        topic_ids = {t['id'] for t in m.get('topics', [])}
        items = d.get('items', [])
        for i, item in enumerate(items):
            ctx = f"{fname}/{i}"
            all_errs += validate_iq(item, ctx, topic_ids)
            item['id'] = f"iq-{mid}-{item.get('topicId', 'x')}-{i}"
        m['identify'] = items
        total_iq += len(items)

    if all_errs:
        print("校验问题:")
        for e in all_errs[:40]:
            print(" -", e)

    db = {
        "version": 2,
        "buildDate": datetime.date.today().isoformat(),
        "exam": "江苏省考行测（B类）",
        "modules": modules,
    }
    out = os.path.join(DATA_DIR, 'db.js')
    with open(out, 'w', encoding='utf-8') as f:
        f.write("/* 自动生成，勿手改。来源: data/mod_*.json + data/id_*.json，运行 python build_data.py 重新生成 */\n")
        f.write("window.XINGCE_DB = ")
        json.dump(db, f, ensure_ascii=False, separators=(',', ':'))
        f.write(";\n")

    print(f"\n模块数: {len(modules)} | 总卡片: {total_cards} | 识别题: {total_iq}")
    for m in modules:
        n = sum(len(t['cards']) for t in m['topics'])
        iq = len(m.get('identify', []))
        print(f"  {m['icon']} {m['moduleName']}: {len(m['topics'])} 题型 / {n} 卡" + (f" / {iq} 识别题" if iq else ""))
    print(f"\n已生成: {out} ({os.path.getsize(out)//1024} KB)")


if __name__ == '__main__':
    main()
