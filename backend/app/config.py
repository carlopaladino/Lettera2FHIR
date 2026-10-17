from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    llm_base_url: str = "https://openrouter.ai/api/v1"
    llm_api_key: str = ""
    llm_model: str = ""
    fhir_base_url: str = "http://localhost:8080/fhir"
    prompt_version: str = "extract-v1"


settings = Settings()
