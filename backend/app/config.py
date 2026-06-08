from pydantic_settings import BaseSettings, SettingsConfigDict
  

class Settings(BaseSettings):
      mongo_uri: str
      database_name: str = "green_garden"
      # Optional: the AI chat stays disabled until you set this in .env
      openai_api_key: str = ""

      model_config = SettingsConfigDict(env_file=".env")

  
settings = Settings()