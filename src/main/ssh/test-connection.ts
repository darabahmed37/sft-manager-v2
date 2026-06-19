import { SshClient } from './SshClient';
import { Config } from '../config/Config';
import { Server } from './types';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: npx ts-node src/main/ssh/test-connection.ts <username>@<host>:[port] [password] [totpSecret] [--jump <jumpUsername>@<jumpHost>:[jumpPort] [jumpPassword] [jumpTotpSecret]]');
    process.exit(1);
  }

  const targetStr = args[0];
  const password = args[1] || '';
  const totpSecret = args[2] || '';

  const targetParts = targetStr.split('@');
  if (targetParts.length < 2) {
    console.error('Invalid target format. Use username@host:port');
    process.exit(1);
  }
  const username = targetParts[0];
  const hostPort = targetParts[1].split(':');
  const host = hostPort[0];
  const port = parseInt(hostPort[1] || '22', 10);

  const targetServer: Server = {
    host,
    port,
    username,
    password,
    totpSecret,
  };

  const chain: Server[] = [targetServer];

  const jumpIndex = args.indexOf('--jump');
  if (jumpIndex !== -1 && args.length > jumpIndex + 1) {
    const jumpStr = args[jumpIndex + 1];
    const jumpPassword = args[jumpIndex + 2] || '';
    const jumpTotpSecret = args[jumpIndex + 3] || '';

    const jumpParts = jumpStr.split('@');
    if (jumpParts.length >= 2) {
      const jUsername = jumpParts[0];
      const jHostPort = jumpParts[1].split(':');
      const jHost = jHostPort[0];
      const jPort = parseInt(jHostPort[1] || '22', 10);

      const jumpServer: Server = {
        host: jHost,
        port: jPort,
        username: jUsername,
        password: jumpPassword,
        totpSecret: jumpTotpSecret,
      };

      chain.unshift(jumpServer);
    }
  }

  console.log(`Connecting hop chain: ${chain.map(s => `${s.username}@${s.host}:${s.port}`).join(' -> ')}`);

  const config = new Config();
  
  try {
    const client = await SshClient.connect(chain, config, (status) => {
      console.log(`[Status Callback] ${status}`);
    });

    console.log('\n--- Connection Successful! ---');
    
    const home = await client.getHomeDir();
    console.log(`Remote Home Directory: ${home}`);

    console.log(`\nListing contents of home directory: ${home}`);
    const entries = await client.listDirectory(home);
    console.table(entries.map(e => ({
      Name: e.name,
      Type: e.isDirectory ? 'Dir' : e.isSymlink ? 'Link' : 'File',
      Size: e.size,
      Permissions: e.permissions,
      Owner: e.owner,
      Date: e.date
    })));

    client.close();
    console.log('Session closed successfully.');

  } catch (error: any) {
    console.error('\n--- Connection Failed! ---');
    console.error(error);
    process.exit(1);
  }
}

main();
