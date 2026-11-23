import asyncio
import logging

from sqlmodel import Session, select
from database import engine
from model import Job, Thumbnail
from openai_service import generate_thumbnail
from sevices.imagekit_service import upload_file

logger = logging.getLogger(__name__)

STYLES = {
    "bold_dramatic": (
        "A bold and dramatic style with strong contrasts, deep shadows, and intense colors. "
    ),
    "clean_minimalist": (
        "A clean and minimalist style with simple compositions, muted colors, and a focus on negative space. "
    ),
    "vibrant_energetic": (
        "A vibrant and energetic style with bright colors, dynamic compositions, and a sense of movement. "
    ),

}

STYLE_ORDER = ["bold_dramatic", "clean_minimalist", "vibrant_energetic"]



async def generate_single_thumbnail(thumbnail_id:str, prompt:str, headshot_url:str):
    try:
        with Session(engine) as session:
            thumb = session.get(Thumbnail, thumbnail_id)
            if thumb is None:
                raise ValueError(f"Thumbnail {thumbnail_id} was not found.")
            thumb.status = "generating"
            style_name = thumb.style_name
            session.add(thumb)
            session.commit()

        style_prompt = STYLES[style_name]
        image_bytes = await generate_thumbnail(prompt, style_prompt, headshot_url)
        with Session(engine) as session:
            thumb = session.get(Thumbnail, thumbnail_id)
            if thumb is None:
                raise ValueError(f"Thumbnail {thumbnail_id} was not found.")
            job_id = thumb.job_id

        url = upload_file(
            file_bytes=image_bytes,
            file_name=f"{thumbnail_id}.png",
            folder=f"thumbnails/{job_id}/",
            )

        with Session(engine) as session:
            thumb = session.get(Thumbnail, thumbnail_id)
            if thumb is None:
                raise ValueError(f"Thumbnail {thumbnail_id} was not found.")
            thumb.imgekit_url = url
            thumb.status = "uploaded"
            session.add(thumb)
            session.commit()
        logger.info(f"Thumbnail {thumbnail_id} generated and uploaded successfully.")
        
    except Exception as e:
        logger.exception(f"Error generating thumbnail {thumbnail_id}")
        with Session(engine) as session:
            thumb = session.get(Thumbnail, thumbnail_id)
            if thumb is not None:
                thumb.status = "failed"
                thumb.error_message = str(e)[:500]
                session.add(thumb)
                session.commit()




async def process_job(job_id: str):
    #mark job as processing
    #find all thumbnails for the job
    #start one worker for each thumbnail
    #wait for all workers to finish
    #mark job as completed or failed
    with Session(engine) as session:
        job = session.get(Job, job_id)
        if job is None:
            logger.error("Cannot process missing job %s", job_id)
            return
        job.status = "processing"
        prompt = job.prompt
        headshot_url = job.headshot_url
        session.add(job)
        session.commit()

        thumbnails = session.exec(
            select(Thumbnail).where(Thumbnail.job_id == job_id)
        ).all()

        thumbnails_ids = [t.id for t in thumbnails]
        tasks = [
            generate_single_thumbnail(tid, prompt, headshot_url)
            for tid in thumbnails_ids
        ]
    await asyncio.gather(*tasks)

    with Session(engine) as session:
        thumbnails = session.exec(
            select(Thumbnail).where(Thumbnail.job_id == job_id)
        ).all()
        job = session.get(Job, job_id)
        if job is not None:
            all_failed = bool(thumbnails) and all(t.status == "failed" for t in thumbnails)
            job.status = "failed" if all_failed else "completed"
            session.add(job)
            session.commit()




