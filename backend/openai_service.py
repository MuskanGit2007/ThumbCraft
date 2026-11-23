import base64
from openai import AsyncOpenAI

from config import OPEN_API_KEY

client = AsyncOpenAI(api_key=OPEN_API_KEY)

async def generate_thumbnail(prompt: str, style_prompt: str, headshot_url: str) -> bytes:
    """
    Use the Responses API image-generation tool to create a thumbnail.
    Pass the headshot URL directly as an input_image.
    Returns raw PNG bytes.
    """

    full_prompt = (
        f"{style_prompt}\n\n"
        f"User request: {prompt}\n\n"
        "IMPORTANT: The generated thumbnail MUST prominently feature the person shown "
        "in the provided reference headshot photo. Preserve their likeness accurately."
    )

    response = await client.responses.create(
        model="gpt-6.2-astra",
        input=[
            {
                "role": "user",
                "content": [
                    {"type": "input_image", "image_url": headshot_url, "detail": "auto"},
                    {"type": "input_text", "text": full_prompt}
                ]
            }
        ],
        tools=[
            {
                "type": "image_generation",
                "model": "gpt-image-2.5-sunburst",
                "size": "1536x1024",
                "quality": "high",
                "output_format": "png",
            }
        ],
    )

    for item in response.output:
        if item.type == "image_generation_call" and item.result:
            return base64.b64decode(item.result)

    raise RuntimeError("No image generated in the response.")