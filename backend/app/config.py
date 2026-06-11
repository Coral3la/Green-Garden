from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mongo_uri: str
    database_name: str = "green_garden"
    openai_api_key: str = ""
    model_config = SettingsConfigDict(env_file=".env")
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60


settings = Settings()
