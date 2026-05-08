# Llama 2 Model Restoration Guide

This document contains instructions to re-download the Llama 2 quantized model if you decide to switch back from the Gemini API to local inference.

## Model Details
- **Filename**: `llama-2-7b-chat.ggmlv3.q8_0-002.bin`
- **Size**: ~6.67 GB
- **Quantization**: Q8_0 (8-bit quantization)
- **Format**: GGML (Used by the `ctransformers` library)

## Download Instructions
You can download the model file from Hugging Face using the following link:

**Direct Download URL**:
[https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGML/resolve/main/llama-2-7b-chat.ggmlv3.q8_0-002.bin](https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGML/resolve/main/llama-2-7b-chat.ggmlv3.q8_0-002.bin)

## Installation Path
After downloading, place the file in the following directory:
`c:\Users\karta\OneDrive\Desktop\MajorProject\edumit\llama2-PDF-Chatbot\model\`

## CLI Download (Optional)
If you have `curl` or `wget` installed, you can run:
```bash
# Using curl
curl -L https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGML/resolve/main/llama-2-7b-chat.ggmlv3.q8_0-002.bin -o edumit/llama2-PDF-Chatbot/model/llama-2-7b-chat.ggmlv3.q8_0-002.bin
```

> [!NOTE]
> The current version of the project uses the **Gemini API** for faster and more accurate clinical reasoning. Local inference with Llama 2 requires significant RAM and CPU/GPU resources.
