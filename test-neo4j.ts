/**
 * Simple script to test Neo4j connectivity
 * Run with: NODE_ENV=development npx tsx test-neo4j.ts
 */

import neo4j from 'neo4j-driver';

async function testNeo4jConnection() {
  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const username = process.env.NEO4J_USERNAME || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || 'password';

  console.log('\nTesting Neo4j connection...');

  let driver: any = null;

  try {
    // Create driver
    driver = neo4j.driver(
      uri,
      neo4j.auth.basic(username, password),
      {
        maxConnectionPoolSize: 10,
        connectionAcquisitionTimeout: 10000,
      }
    );

    console.log('Driver created successfully');

    // Verify connectivity
    await driver.verifyConnectivity();
    console.log('✓ Neo4j connectivity verified!');

    // Get version info
    const session = driver.session();
    try {
      const result = await session.run(
        'CALL dbms.components() YIELD name, versions, edition RETURN name, versions, edition'
      );

      if (result.records.length > 0) {
        const record = result.records[0];
        const name = record.get('name');
        const versions = record.get('versions');
        const edition = record.get('edition');

        console.log('\n✓ Neo4j Details:');
        console.log(`  Name: ${name}`);
        console.log(`  Version: ${versions[0]}`);
        console.log(`  Edition: ${edition}`);
      }

      // Test basic query
      const testResult = await session.run('RETURN "Hello from Neo4j!" AS message');
      const message = testResult.records[0]?.get('message');
      console.log(`\n✓ Test query successful: ${message}`);

      console.log('\n✓ All tests passed! Neo4j is ready to use.\n');
      return true;
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error('\n✗ Neo4j connection failed:');
    console.error(error);
    console.log('\nMake sure:');
    console.log('1. Neo4j container is running (docker-compose up neo4j)');
    console.log('2. Environment variables are set correctly');
    console.log('3. Neo4j is accessible at the specified URI\n');
    return false;
  } finally {
    if (driver) {
      await driver.close();
    }
  }
}

// Run the test
testNeo4jConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
