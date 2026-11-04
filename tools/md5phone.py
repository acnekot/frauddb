#!/usr/bin/env python3
"""按前缀枚举号码，用 MD5 反查目标哈希。

只对自己有权访问的数据使用。用于验证本机数据库里 tel_number_md5 对应的号码。

示例：
    # 已知号段 1381，枚举后 7 位
    python3 md5phone.py --target 0f1e2d... --prefix 1381

    # 一次查多个哈希
    python3 md5phone.py --target aaa... --target bbb... --prefix 138

    # 只测速，不真跑
    python3 md5phone.py --bench --prefix 1381
"""
import argparse
import hashlib
import multiprocessing as mp
import os
import sys
import time

DIGITS = "0123456789"


def _scan(args):
    prefix, width, start, end, targets = args
    md5 = hashlib.md5
    hit = []
    zfill = str.zfill
    for i in range(start, end):
        s = prefix + zfill(str(i), width)
        if md5(s.encode("utf-8")).hexdigest() in targets:
            hit.append(s)
    return hit


def run(prefix, width, targets, workers):
    total = 10 ** width
    workers = max(1, min(workers, total))
    step = total // workers
    jobs = []
    for w in range(workers):
        a = w * step
        b = total if w == workers - 1 else a + step
        jobs.append((prefix, width, a, b, targets))

    t0 = time.time()
    hits = []
    with mp.Pool(workers) as pool:
        for r in pool.imap_unordered(_scan, jobs):
            hits.extend(r)
    dt = time.time() - t0
    return hits, total, dt


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", action="append", default=[], help="目标 MD5，可重复")
    ap.add_argument("--prefix", default="", help="固定前缀，例如 138 或 1381")
    ap.add_argument("--suffix", type=int, default=None, help="枚举位数，默认补满 11 位")
    ap.add_argument("--workers", type=int, default=os.cpu_count() or 1)
    ap.add_argument("--bench", action="store_true", help="只测速")
    a = ap.parse_args()

    if a.bench:
        targets = {hashlib.md5(b"__bench__").hexdigest()}
    else:
        if not a.target:
            ap.error("需要 --target，或用 --bench 只测速")
        targets = {t.strip().lower() for t in a.target}

    width = a.suffix if a.suffix is not None else max(0, 11 - len(a.prefix))
    total = 10 ** width

    print(f"前缀 {a.prefix or '(空)'} + {width} 位 = {total:,} 个候选，{a.workers} 进程", flush=True)
    hits, total, dt = run(a.prefix, width, targets, a.workers)
    rate = total / dt if dt > 0 else 0

    print(f"完成 {total:,} 个，用时 {dt:.1f}s，速度 {rate / 1e6:.2f} M/s")
    if a.bench:
        for label, space in (("11 位手机号全量", 9 * 10 ** 9),
                             ("号段+后 4 位", 10 ** 4),
                             ("号段+后 5 位", 10 ** 5)):
            print(f"  {label}（约 {space:,} 个）≈ {space / rate / 60:.1f} 分钟（按本机速度）")
    else:
        if hits:
            for h in hits:
                print("命中：", h)
        else:
            print("未命中")
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
