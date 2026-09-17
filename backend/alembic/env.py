from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings
from app.database import Base
from app import models  # noqa: F401 — registers all models on Base.metadata

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# postgis/postgis ships with postgis_tiger_geocoder pre-installed, which
# creates a large set of tables (county_lookup, edges, faces, tract,
# place, spatial_ref_sys, topology, and many more) that belong to the
# PostGIS/Tiger extensions, not this app. Without this filter,
# autogenerate treats every one of them as "extra" and drops them each
# time -- which then fails, because Postgres won't let you drop a table
# an extension owns except via DROP EXTENSION. Excluding them by name
# keeps every future `alembic revision --autogenerate` limited to this
# app's own tables.
_EXTENSION_OWNED_TABLES = {
    "spatial_ref_sys", "topology", "layer",
    "county", "county_lookup", "countysub_lookup", "cousub",
    "state", "state_lookup", "place", "place_lookup",
    "zip_lookup", "zip_lookup_all", "zip_lookup_base", "zip_state",
    "zip_state_loc", "zcta5", "tract", "bg", "tabblock", "tabblock20",
    "faces", "featnames", "addr", "addrfeat", "edges",
    "direction_lookup", "secondary_unit_lookup", "street_type_lookup",
    "geocode_settings", "geocode_settings_default",
    "loader_lookuptables", "loader_platform", "loader_variables",
    "pagc_gaz", "pagc_lex", "pagc_rules",
}


def include_object(object, name, type_, reflected, compare_to):
    if type_ == "table" and name in _EXTENSION_OWNED_TABLES:
        return False
    if type_ == "index" and object.table.name in _EXTENSION_OWNED_TABLES:
        return False
    return True


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, include_object=include_object)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
