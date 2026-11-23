import base64
import inspect
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from imagekitio._files import _transform_file
from openai.types.responses import ResponseInputItemParam
from pydantic import TypeAdapter

import openai_service
from sevices import imagekit_service


class ExternalServicePayloadTests(unittest.IsolatedAsyncioTestCase):
    async def test_openai_response_input_matches_sdk_schema(self):
        response = SimpleNamespace(
            output=[
                SimpleNamespace(
                    type="image_generation_call",
                    result=base64.b64encode(b"png-bytes").decode("ascii"),
                )
            ]
        )

        with patch.object(
            openai_service.client.responses,
            "create",
            new=AsyncMock(return_value=response),
        ) as create:
            image_bytes = await openai_service.generate_thumbnail(
                "creator prompt",
                "bold style",
                "https://cdn.example/headshot.png",
            )

        self.assertEqual(image_bytes, b"png-bytes")
        request = create.await_args.kwargs
        self.assertEqual(request["model"], "gpt-6.2-astra")
        self.assertEqual(
            request["tools"][0]["model"],
            "gpt-image-2.5-sunburst",
        )
        TypeAdapter(ResponseInputItemParam).validate_python(request["input"][0])
        content = request["input"][0]["content"]
        self.assertEqual(content[0]["type"], "input_image")
        self.assertEqual(content[0]["image_url"], "https://cdn.example/headshot.png")
        self.assertEqual(content[1]["type"], "input_text")

    def test_imagekit_upload_file_tuple_matches_sdk_format(self):
        sdk_upload = imagekit_service.imagekit.files.upload
        signature = inspect.signature(sdk_upload)
        received = {}

        def fake_upload(**kwargs):
            signature.bind(**kwargs)
            self.assertEqual(
                _transform_file(kwargs["file"]),
                ("headshot.png", b"png-bytes", "image/png"),
            )
            received.update(kwargs)
            return SimpleNamespace(url="https://cdn.example/headshot.png")

        with patch.object(
            imagekit_service.imagekit.files,
            "upload",
            side_effect=fake_upload,
        ):
            url = imagekit_service.upload_file(
                b"png-bytes",
                "headshot.png",
                "/headshots",
                "image/png",
            )

        self.assertEqual(url, "https://cdn.example/headshot.png")
        self.assertEqual(received["file_name"], "headshot.png")
