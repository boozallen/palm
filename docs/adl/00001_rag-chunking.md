# ADR 00001: RAG Chunking

## Context
Document chunking in a RAG (Retriever-Augmented Generation) pipeline refers to the process of dividing large documents into smaller, more manageable sections called chunks. 
Each chunk is then separately encoded into vector representations to be used in the retrieval stage. 
This approach is used to address the challenge of dealing with large documents within the constraints of the maximum token limit of transformers, and there are many ways to accomplish this approach.
Document chunking can either be accomplished through a homegrown approach or through the implementation of a third party library.

## Decision
For V1 of the RAG pipeline, we will be using a naive chunking approach and build out handling to chunk up a document based on chunk size.
For V2, if enhanced chunking methods are necessary, like HTML or markdown parsing, we will investigate a library, like LangChain, that has that functionality already implemented.

## Status
Status: *Accepted*

## Consequences
Positive Consequences
1. Dependency size: PALM will not require a large dependency for the act of naive text splitting.
2. Customization: A custom text chunking strategy allows us to develop a parsing algorithm specifically constructed for the needs of PALM.
3. Optimization: The chunking algorithm can be continually optimized based on specific requirements or results from performance metrics.
4. Complete Control: The PALM team will have full control over the updates, changes, and other alterations without waiting for a third party to make changes.
5. Enhanced Security: The information security would be under PALM's control, reducing the risk of data leaks or breaches.
6. Interoperability: A custom text chunking strategy facilitates easy integration with the existing business logic. 
7. Reliability: PALM would not be reliant on another service which may get discontinued or encounter integration issues.

Negative Consequences 
1. Time-consuming: Implementing a custom text chunking algorithm within PALM may be more time-consuming than pulling in a library. Time will need to be spent researching, designing, and coding the algorithm.
2. Increased complexity: Implementing text chunking can lead to additional complexity and can make the code harder to understand, maintain or update.
3. Lack of thorough testing: Third-party libraries usually go through comprehensive testing before they are released. However, with a custom strategy, it is up to the developer to fully test the code, which may lead to more bugs and inconsistencies.
4. Lack of continuous updates: Libraries receive regular updates and improvements based on the feedback from a large community of users. With a custom strategy, all found issues will need to be resolved within the team.
5. Less accurate: Text chunking tools are developed by experts and improve their accuracy over time. A custom solution might not be as accurate, especially in the beginning, and can require a lot of fine-tuning.
6. Decreased efficiency: A custom text chunking strategy might not be as fast or efficient as a third-party library which can limit the performance of RAG within PALM.

## References
A primer on Text Chunking and its Types: https://blog.lancedb.com/a-primer-on-text-chunking-and-its-types-a420efc96a13 
How to Chunk Data: https://towardsdatascience.com/how-to-chunk-text-data-a-comparative-analysis-3858c4a0997a
Chunking Strategies: https://www.pinecone.io/learn/chunking-strategies/
How to Optimize Test Chunking for Improved Embedding Vectorization: https://community.openai.com/t/how-to-optimize-text-chunking-for-improved-embedding-vectorization/380369/6
How to Chunk Effectively: https://www.reddit.com/r/OpenAI/comments/15wayu9/how_to_chunk_effectively/ 
The Length of Embedding Contents: https://community.openai.com/t/the-length-of-the-embedding-contents/111471?page=2 


## Alternatives
A list of text chunking libraries that were considered but not chosen: 
Natural: https://naturalnode.github.io/natural/Tokenizers.html 
chunk-text: https://www.npmjs.com/package/chunk-text 
LangChain: https://github.com/langchain-ai/langchain

