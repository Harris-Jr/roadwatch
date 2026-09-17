"""initial schema

Revision ID: f4370bbd7f60
Revises:
Create Date: 2026-09-16 10:01:30.597933

Note: the postgis/postgis Docker image ships with the
postgis_tiger_geocoder extension pre-installed, which creates a large
number of US Census TIGER geocoder tables (county_lookup, edges, faces,
tract, place, etc.) out of the box. Alembic's autogenerate diffed the
live DB against our SQLAlchemy models and flagged all of those as
"extra" tables to drop -- but they belong to the extension, not this
app, and Postgres refuses to drop them individually (only via `DROP
EXTENSION postgis_tiger_geocoder`, which we don't want -- it would also
remove postgis_tiger_geocoder's geocoding functions). This migration
was hand-trimmed to only create/drop tables this app actually owns.
"""
from alembic import op
import sqlalchemy as sa
import geoalchemy2

# revision identifiers, used by Alembic.
revision = 'f4370bbd7f60'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('app_settings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('minor_threshold', sa.Float(), nullable=False),
    sa.Column('moderate_threshold', sa.Float(), nullable=False),
    sa.Column('severe_threshold', sa.Float(), nullable=False),
    sa.Column('email_digest_time', sa.String(length=10), nullable=False),
    sa.Column('sms_for_severe_enabled', sa.Boolean(), nullable=False),
    sa.Column('data_retention_days', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('road_segments',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('category', sa.Enum('inter_territorial', 'territorial', 'district', 'branch', 'rural', 'estate', name='roadcategory'), nullable=False),
    sa.Column('responsible_entity', sa.String(length=255), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('hashed_password', sa.String(length=255), nullable=False),
    sa.Column('full_name', sa.String(length=255), nullable=False),
    sa.Column('role', sa.Enum('individual', 'business', 'government', name='userrole'), nullable=False),
    sa.Column('plan', sa.Enum('free', 'premium', 'business', name='plan'), nullable=True),
    sa.Column('organization', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_table('corridors',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('business_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('start_lat', sa.Float(), nullable=False),
    sa.Column('start_lon', sa.Float(), nullable=False),
    sa.Column('end_lat', sa.Float(), nullable=False),
    sa.Column('end_lon', sa.Float(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['business_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('processing_jobs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('filename', sa.String(length=500), nullable=False),
    sa.Column('file_path', sa.String(length=1000), nullable=False),
    sa.Column('gps_log_path', sa.String(length=1000), nullable=True),
    sa.Column('status', sa.Enum('queued', 'processing', 'completed', 'failed', name='jobstatus'), nullable=False),
    sa.Column('uploaded_by_id', sa.Integer(), nullable=True),
    sa.Column('frames_processed', sa.Integer(), nullable=False),
    sa.Column('detections_found', sa.Integer(), nullable=False),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('uploaded_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['uploaded_by_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('refresh_sessions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('jti', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('revoked_at', sa.DateTime(), nullable=True),
    sa.Column('last_used_at', sa.DateTime(), nullable=True),
    sa.Column('replaced_by_id', sa.Integer(), nullable=True),
    sa.Column('created_ip', sa.String(length=64), nullable=True),
    sa.Column('last_used_ip', sa.String(length=64), nullable=True),
    sa.Column('user_agent', sa.String(length=500), nullable=True),
    sa.ForeignKeyConstraint(['replaced_by_id'], ['refresh_sessions.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_refresh_sessions_jti'), 'refresh_sessions', ['jti'], unique=True)
    op.create_index(op.f('ix_refresh_sessions_token_hash'), 'refresh_sessions', ['token_hash'], unique=True)
    op.create_index(op.f('ix_refresh_sessions_user_id'), 'refresh_sessions', ['user_id'], unique=False)
    op.create_table('vehicles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('business_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('plate_number', sa.String(length=50), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['business_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('reports',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('road_name', sa.String(length=255), nullable=False),
    sa.Column('road_segment_id', sa.Integer(), nullable=True),
    sa.Column('severity', sa.Enum('minor', 'moderate', 'severe', name='severity'), nullable=False),
    sa.Column('confidence', sa.Float(), nullable=False),
    sa.Column('status', sa.Enum('reported', 'in_progress', 'fixed', name='reportstatus'), nullable=False),
    sa.Column('source', sa.Enum('quick_report', 'council_survey', name='reportsource'), nullable=False),
    sa.Column('location', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
    sa.Column('photo_url', sa.String(length=1000), nullable=True),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('assigned_council', sa.String(length=255), nullable=True),
    sa.Column('processing_job_id', sa.Integer(), nullable=True),
    sa.Column('frame_timestamp_seconds', sa.Float(), nullable=True),
    sa.Column('confirmed', sa.Boolean(), nullable=False),
    sa.Column('reported_by_id', sa.Integer(), nullable=True),
    sa.Column('reported_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['processing_job_id'], ['processing_jobs.id'], ),
    sa.ForeignKeyConstraint(['reported_by_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['road_segment_id'], ['road_segments.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # No explicit op.create_index('idx_reports_location', ...) here --
    # GeoAlchemy2's Geometry column type creates this GIST spatial index
    # automatically via a DDL event hook the moment 'reports' is created
    # above. An explicit second create_index for the same name would
    # fail with DuplicateTable.


def downgrade() -> None:
    op.drop_table('reports')
    op.drop_table('vehicles')
    op.drop_index(op.f('ix_refresh_sessions_user_id'), table_name='refresh_sessions')
    op.drop_index(op.f('ix_refresh_sessions_token_hash'), table_name='refresh_sessions')
    op.drop_index(op.f('ix_refresh_sessions_jti'), table_name='refresh_sessions')
    op.drop_table('refresh_sessions')
    op.drop_table('processing_jobs')
    op.drop_table('corridors')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.drop_table('road_segments')
    op.drop_table('app_settings')
