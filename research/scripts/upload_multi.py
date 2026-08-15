"""
upload_multi.py — Upload the cached multi-dataset local_data_multi/ to S3
under data_multi/<name>/ so the Lambda backend can serve all datasets.

The shared eigenbasis (evals/evecs/L), mesh, and sulcal maps already live
under data/ from the single-dataset prep — only the per-dataset X, Y and
contrasts are uploaded here.

Usage:
    python aws/scripts/upload_multi.py --bucket laplacian-glm-data
"""
import argparse
from pathlib import Path

import boto3


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--bucket", required=True)
    ap.add_argument("--region", default="us-east-1")
    ap.add_argument("--dir", default="./local_data_multi")
    args = ap.parse_args()

    s3 = boto3.client("s3", region_name=args.region)
    d = Path(args.dir)
    for sub in sorted(p for p in d.iterdir() if p.is_dir()):
        for fname in ("X.npy", "Y.npy", "contrasts.npz"):
            path = sub / fname
            key = f"data_multi/{sub.name}/{fname}"
            s3.upload_file(str(path), args.bucket, key)
            print(f"  uploaded {key}  ({path.stat().st_size / 1e6:.1f} MB)")
    print("Done.")


if __name__ == "__main__":
    main()
