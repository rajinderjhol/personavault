from extensions import db

class AISetting(db.Model):
    __tablename__ = 'ai_settings'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    profile_name = db.Column(db.String, nullable=False, default='Default', server_default='Default')
    provider_type = db.Column(db.String, db.CheckConstraint("provider_type IN ('Ollama', 'Internet', 'Hybrid')"), nullable=True)
    model_name = db.Column(db.String, nullable=False)
    api_key_enc = db.Column(db.String, nullable=True)
    api_endpoint = db.Column(db.String, nullable=True)
    temperature = db.Column(db.Float, default=0.7, server_default="0.7")
    max_tokens = db.Column(db.Integer, default=100, server_default="100")
    system_prompt = db.Column(db.String, nullable=True)
    deployment_type = db.Column(db.String, db.CheckConstraint("deployment_type IN ('local', 'internet', 'hybrid')"), nullable=True)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp(), server_default=db.func.current_timestamp())
    model_description = db.Column(db.String, nullable=True)  # Description of the model
    top_p = db.Column(db.Float, default=0.0, server_default="0.0")
    response_format = db.Column(db.String, nullable=True)
    language = db.Column(db.String, nullable=True)
    is_active = db.Column(db.Boolean, default=True, server_default="1")  # SQLite stores as 1/0
    embedding_model = db.Column(db.String, nullable=True)
    fallback_model_name = db.Column(db.String, nullable=True)
    fallback_provider_type = db.Column(db.String, nullable=True)
    presence_penalty = db.Column(db.Float, default=0.0, server_default="0.0")
    frequency_penalty = db.Column(db.Float, default=0.0, server_default="0.0")
    user_context = db.Column(db.String, nullable=True)
    privacy_level = db.Column(db.String, nullable=True)
    tags = db.Column(db.String, nullable=True)
    expiry_days = db.Column(db.Integer, default=0, server_default="0")
    provider_name = db.Column(db.String, nullable=True)
