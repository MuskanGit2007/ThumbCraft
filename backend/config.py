import os
from dotenv import load_dotenv

load_dotenv()

OPEN_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("OPEN_API_KEY", "")
IMAGE_PRIVATE_KEY = os.getenv("IMAGE_PRIVATE_KEY", "")
IMAGE_PUBLIC_KEY = os.getenv("IMAGE_PUBLIC_KEY", "")    
IMAGEKIT_URL_ENDPOINT = os.getenv("IMAGEKIT_URL_ENDPOINT", "")


DATABASE_URL = "sqlite:///./thumbnailbuilder.db"