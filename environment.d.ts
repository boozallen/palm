declare global {
  namespace NodeJS {
    interface ProcessEnv {
      AZURE_AD_CLIENT_ID: string;
      AZURE_AD_CLIENT_SECRET: string;
      AZURE_AD_TENANT_ID: string;
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export { };
