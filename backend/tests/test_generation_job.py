import unittest
from unittest.mock import AsyncMock, patch

import database
import grnerater
import routes
from model import Job, Thumbnail
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select


class GenerationJobTests(unittest.IsolatedAsyncioTestCase):
    async def test_job_generates_uploads_and_returns_results(self):
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(engine)

        with Session(engine) as session:
            job = Job(prompt="creator prompt", headshot_url="https://cdn.example/face.png")
            session.add(job)
            session.commit()
            thumbnail = Thumbnail(job_id=job.id, style_name="bold_dramatic")
            session.add(thumbnail)
            session.commit()
            job_id = job.id
            thumbnail_id = thumbnail.id

        with (
            patch.object(grnerater, "engine", engine),
            patch.object(
                grnerater,
                "generate_thumbnail",
                new=AsyncMock(return_value=b"png-bytes"),
            ),
            patch.object(
                grnerater,
                "upload_file",
                return_value="https://cdn.example/generated.png",
            ) as upload,
        ):
            await grnerater.process_job(job_id)

        upload.assert_called_once()
        self.assertEqual(upload.call_args.kwargs["folder"], f"thumbnails/{job_id}/")

        with Session(engine) as session:
            job = session.get(Job, job_id)
            thumbnail = session.exec(
                select(Thumbnail).where(Thumbnail.id == thumbnail_id)
            ).one()
            self.assertEqual(job.status, "completed")
            self.assertEqual(thumbnail.status, "uploaded")
            self.assertEqual(
                thumbnail.imgekit_url,
                "https://cdn.example/generated.png",
            )
            result = routes.get_job(job_id, session).model_dump()
            self.assertEqual(
                result["thumbnails"][0]["imagekit_url"],
                "https://cdn.example/generated.png",
            )

        with patch.object(database, "engine", engine):
            stream = await routes.steam_job(job_id)
            chunks = [
                chunk.decode() if isinstance(chunk, bytes) else chunk
                async for chunk in stream.body_iterator
            ]
            events = "".join(chunks)
        self.assertIn("event: thumbnail_ready", events)
        self.assertIn("event: job_completed", events)
