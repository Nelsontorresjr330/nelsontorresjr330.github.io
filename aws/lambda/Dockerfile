FROM public.ecr.aws/lambda/python:3.12

# Writable dirs for matplotlib and nilearn caches
ENV MPLCONFIGDIR=/tmp/matplotlib
ENV NILEARN_DATA=/tmp/nilearn_data

RUN pip install --no-cache-dir \
    numpy scipy matplotlib Pillow \
    "nilearn>=0.10" nibabel boto3

COPY handler.py ${LAMBDA_TASK_ROOT}/

CMD ["handler.lambda_handler"]
