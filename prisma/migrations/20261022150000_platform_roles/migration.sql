CREATE TYPE "PlatformRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'MEMBER');

ALTER TABLE "User"
ADD COLUMN "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER';

ALTER TABLE "WorkspaceMember"
ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "WorkspaceMember"
ALTER COLUMN "role" TYPE "WorkspaceRole"
USING CASE
  WHEN "role" = 'OWNER' THEN 'OWNER'::"WorkspaceRole"
  ELSE 'MEMBER'::"WorkspaceRole"
END;

ALTER TABLE "WorkspaceMember"
ALTER COLUMN "role" SET DEFAULT 'OWNER';
