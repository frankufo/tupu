


// utils/neo4jService.js
import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'password')
);

export async function runCypher(cypher, params = {}) {
  const session = driver.session({
  database: 'base11'
});
  try {
    return await session.run(cypher, params);
  } finally {
    await session.close();
  }
}
