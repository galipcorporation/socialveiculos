"""revoga EXECUTE de public.rls_auto_enable() para anon/authenticated/public

O Security Advisor do Supabase acusou dois warnings na mesma função
(`public.rls_auto_enable()`): "Public Can Execute SECURITY DEFINER Function" e
"Signed-In Users Can Execute SECURITY DEFINER Function". Sendo SECURITY DEFINER
no schema `public`, o PostgREST a expõe em `/rest/v1/rpc/rls_auto_enable` e ela
roda com os privilégios do dono — qualquer requisição anônima podia chamá-la.

A função NÃO é do nosso código (nenhuma migration a cria; foi criada direto no
SQL editor do painel). Nossa API fala com o Postgres por conexão direta, não pelo
PostgREST, então revogar o EXECUTE não afeta nada nosso. Não usamos DROP porque
o corpo dela não está versionado em lugar nenhum — revogar remove a exposição
sem destruir algo que não sabemos reconstruir.

Idempotente (REVOKE em privilégio ausente é no-op) e sem PRAGMA/batch_alter_table.
No-op em SQLite: roles e SECURITY DEFINER só existem no Postgres.

Revision ID: b3c9e14a7f26
Revises: a4e7c1b93d05
Create Date: 2026-08-12 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3c9e14a7f26'
down_revision: Union[str, None] = 'a4e7c1b93d05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return

    # A função pode não existir (outro projeto/ambiente) e os roles do Supabase
    # (anon/authenticated) não existem num Postgres cru — nos dois casos o REVOKE
    # levantaria erro e derrubaria o boot. Por isso o guard antes de emitir.
    existe = bind.execute(sa.text("""
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
        LIMIT 1
    """)).scalar()
    if not existe:
        return

    for role in ('anon', 'authenticated'):
        tem_role = bind.execute(
            sa.text("SELECT 1 FROM pg_roles WHERE rolname = :r"), {'r': role}
        ).scalar()
        if tem_role:
            op.execute(f'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM {role}')

    # PUBLIC é o grant implícito que o Postgres dá a toda função nova; sem revogar
    # este, os REVOKEs por role acima não bastam.
    op.execute('REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC')


def downgrade() -> None:
    # Sem volta de propósito: reconceder EXECUTE a anon reabriria a falha.
    pass
