/**
 * Promote a Cognito user to the Admin group. Use this to bootstrap the first
 * admin tester on a fresh deployment or to grant admin access on demand.
 *
 * Usage:
 *   cd infra && MSYS_NO_PATHCONV=1 npx tsx scripts/promote-admin.ts <email> --profile hyrax-fitness
 *
 * Optional flags:
 *   --user-pool-id <id>   Override the user pool (defaults to VITE_COGNITO_USER_POOL_ID
 *                         loaded from ../.env.local)
 *   --region <region>     AWS region (defaults to us-east-1)
 *   --remove              Remove from Admin group instead of adding
 *
 * This script is idempotent. Adding an existing member is a no-op; removing a
 * non-member is also a no-op.
 */

import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { fromIni } from '@aws-sdk/credential-providers';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') });

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith('--') && a !== args[args.indexOf('--profile') + 1]
  && a !== args[args.indexOf('--user-pool-id') + 1] && a !== args[args.indexOf('--region') + 1]);

const profileIdx = args.indexOf('--profile');
const profile = profileIdx !== -1 ? args[profileIdx + 1] : undefined;

const poolIdx = args.indexOf('--user-pool-id');
const userPoolId = poolIdx !== -1 ? args[poolIdx + 1] : process.env.VITE_COGNITO_USER_POOL_ID;

const regionIdx = args.indexOf('--region');
const region = regionIdx !== -1 ? args[regionIdx + 1] : 'us-east-1';

const remove = args.includes('--remove');

if (!email) {
  console.error('Usage: npx tsx scripts/promote-admin.ts <email> [--profile <aws-profile>] [--user-pool-id <id>] [--region <region>] [--remove]');
  process.exit(1);
}

if (!userPoolId) {
  console.error('Missing user pool id. Pass --user-pool-id or set VITE_COGNITO_USER_POOL_ID in .env.local.');
  process.exit(1);
}

const cognito = new CognitoIdentityProviderClient({
  region,
  ...(profile ? { credentials: fromIni({ profile }) } : {}),
});

async function resolveUsername(targetEmail: string): Promise<string> {
  const result = await cognito.send(
    new ListUsersCommand({
      UserPoolId: userPoolId!,
      Filter: `email = "${targetEmail}"`,
      Limit: 5,
    })
  );
  const users = result.Users || [];
  if (users.length === 0) {
    throw new Error(`No Cognito user found with email: ${targetEmail}`);
  }
  if (users.length > 1) {
    console.warn(`Warning: multiple users match ${targetEmail}. Using the first.`);
  }
  const username = users[0].Username;
  if (!username) throw new Error('Matched user has no Username attribute');
  return username;
}

(async () => {
  try {
    const username = await resolveUsername(email!);
    if (remove) {
      await cognito.send(
        new AdminRemoveUserFromGroupCommand({
          UserPoolId: userPoolId!,
          Username: username,
          GroupName: 'Admin',
        })
      );
      console.log(`Removed ${email} (${username}) from Admin group`);
    } else {
      await cognito.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: userPoolId!,
          Username: username,
          GroupName: 'Admin',
        })
      );
      console.log(`Added ${email} (${username}) to Admin group. Tell them to sign out and back in.`);
    }
  } catch (err: any) {
    console.error('Failed:', err?.message || err);
    process.exit(1);
  }
})();
