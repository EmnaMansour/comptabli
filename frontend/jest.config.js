export default {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', {
      jsc: {
        transform: {
          react: {
            runtime: 'automatic'
          },
          optimizer: {
            globals: {
              vars: {
                'import.meta.env.VITE_API_URL': '"http://localhost:3000"',
                'import.meta.env.VITE_WS_URL': '"http://localhost:3000"',
                'import.meta.env.DEV': 'true',
                'import.meta.env.PROD': 'false',
                'import.meta.env.SSR': 'false'
              }
            }
          }
        }
      }
    }],
  },
  moduleNameMapper: {
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
