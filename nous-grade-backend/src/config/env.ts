import path from 'path';
import dotenv from 'dotenv';

const projectRootEnvPath = path.resolve(__dirname, '../../.env');
const backendEnvPath = path.resolve(__dirname, '../.env');

const getErrorCode = (error?: Error) => {
  return (error as NodeJS.ErrnoException | undefined)?.code;
};

const loadEnvFile = (envPath: string, options?: dotenv.DotenvConfigOptions) => {
  const result = dotenv.config({ path: envPath, ...options });
  const errorCode = getErrorCode(result.error);

  if (result.error && errorCode !== 'ENOENT') {
    console.warn(`⚠️  Failed to load environment file at ${envPath}:`, result.error);
  }

  return { ...result, errorCode };
};

// Load environment variables from the project root first
const rootResult = loadEnvFile(projectRootEnvPath);

// Then load backend-specific overrides (if any)
loadEnvFile(backendEnvPath, { override: true });

if (rootResult.errorCode === 'ENOENT') {
  console.warn('⚠️  Root .env file not found. Continuing with backend .env or process environment variables.');
}


