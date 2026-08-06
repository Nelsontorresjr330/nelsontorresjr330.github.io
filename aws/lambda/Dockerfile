FROM public.ecr.aws/lambda/python:3.12

# Writable dirs for matplotlib and nilearn caches
ENV MPLCONFIGDIR=/tmp/matplotlib
ENV NILEARN_DATA=/tmp/nilearn_data

RUN pip install --no-cache-dir \
    numpy scipy matplotlib Pillow \
    "nilearn>=0.10" nibabel boto3

# Build context is aws/ so we can pull the shared math module (aws/scripts/core_glm.py)
# alongside the handler — single source of truth with the offline search.
COPY lambda/handler.py scripts/core_glm.py ${LAMBDA_TASK_ROOT}/

CMD ["handler.lambda_handler"]
