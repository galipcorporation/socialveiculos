import os
import uuid
import shutil
from typing import Optional
import boto3
from botocore.exceptions import ClientError

from config import settings

class StorageProvider:
    def __init__(self):
        # Verificar se as configurações do S3 foram fornecidas
        self.use_s3 = all([
            settings.s3_access_key,
            settings.s3_secret_key,
            settings.s3_bucket_name
        ])

        if self.use_s3:
            print("[Storage] Usando provedor S3/MinIO para armazenamento de mídias.")
            s3_args = {
                "aws_access_key_id": settings.s3_access_key,
                "aws_secret_access_key": settings.s3_secret_key,
                "region_name": settings.s3_region
            }
            if settings.s3_endpoint_url:
                s3_args["endpoint_url"] = settings.s3_endpoint_url

            self.s3_client = boto3.client("s3", **s3_args)
            self.bucket_name = settings.s3_bucket_name
        else:
            print("[Storage] Usando provedor LOCAL de desenvolvimento.")
            self.local_dir = os.path.join(os.path.dirname(__file__), "static", "uploads")
            os.makedirs(self.local_dir, exist_ok=True)

    # Extensão é derivada do content_type já validado pelo router (whitelist),
    # nunca do nome de arquivo enviado pelo cliente — evita salvar .php/.exe
    # disfarçado de imagem com Content-Type forjado.
    CONTENT_TYPE_EXT = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "video/mp4": ".mp4",
        "video/mpeg": ".mpeg",
        "video/quicktime": ".mov",
        "video/webm": ".webm",
        "application/pdf": ".pdf",
    }

    def generate_filename(self, original_filename: str, content_type: str = "") -> str:
        ext = self.CONTENT_TYPE_EXT.get(content_type)
        if ext is None:
            ext = os.path.splitext(original_filename)[1].lower()
        return f"{uuid.uuid4().hex}{ext}"

    async def upload_file(self, file_content: bytes, filename: str, content_type: str) -> str:
        """
        Faz upload do arquivo e retorna a URL pública de acesso.
        """
        unique_filename = self.generate_filename(filename, content_type)

        if self.use_s3:
            try:
                # Fazer upload para o S3
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=unique_filename,
                    Body=file_content,
                    ContentType=content_type
                )
                if settings.s3_public_url:
                    return f"{settings.s3_public_url.rstrip('/')}/{unique_filename}"
                else:
                    endpoint = settings.s3_endpoint_url or f"https://s3.{settings.s3_region}.amazonaws.com"
                    return f"{endpoint.rstrip('/')}/{self.bucket_name}/{unique_filename}"
            except ClientError as e:
                print(f"[Storage] Erro ao fazer upload para S3: {e}")
                raise e
        else:
            # Salvar localmente
            file_path = os.path.join(self.local_dir, unique_filename)
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            # Retornar URL local
            return f"/static/uploads/{unique_filename}"

    async def delete_file(self, file_url: str):
        """
        Remove um arquivo do storage baseado em sua URL pública.
        """
        filename = file_url.split("/")[-1]

        if self.use_s3:
            try:
                self.s3_client.delete_object(Bucket=self.bucket_name, Key=filename)
            except ClientError as e:
                print(f"[Storage] Erro ao deletar do S3: {e}")
        else:
            file_path = os.path.join(self.local_dir, filename)
            if os.path.exists(file_path):
                os.remove(file_path)


storage_provider = StorageProvider()
