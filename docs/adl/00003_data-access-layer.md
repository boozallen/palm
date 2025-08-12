# ADR 00003: Data Access Layer (DAL)

## Context
Our project's database interactions were previously deeply integrated with the database's structure. This close coupling posed challenges for maintainability and scalability, particularly as we aimed to evolve our application's features. Recognizing the need for a more modular and flexible approach, and with a commitment to continue using Prisma and tRPC, we identified the necessity for a significant architectural enhancement. The primary force driving this change is the goal to decouple our application logic from direct database interactions, thereby improving code maintainability and future-proofing our development efforts.

## Decision
To address the identified challenges, we will introduce a Data Access Layer (DAL) into our architecture, effectively separating the database access code from the tRPC routes. This decision marks a strategic move to refine our existing layers — focusing specifically on enhancing the database interaction model through the DAL. By doing so, we aim to:
 - Decouple database access from business logic, allowing for greater flexibility and maintainability.
 - Streamline the process of updating and managing the database schema without necessitating widespread changes across the application code.
 - Maintain our commitment to using Prisma and tRPC by integrating them within this new architectural framework.

## Status
Status: *Accepted*

## Consequences
Positive Consequences
1. The introduction of the DAL enhances code robustness and adaptability, facilitating easier updates to the database schema with minimal impact on the broader codebase.
2. By centralizing database queries within the DAL, we can avoid duplicating query logic across different parts of the application. So, when a query needs to be updated or fixed, changes are only required in one place, reducing the likelihood of inconsistencies and bugs.
3. It allows us to abstract the specifics of the database engine being used, making it easier to switch databases or incorporate additional data sources as needed without significant changes to the application logic.
4. Managing transactions can be centralized within the DAL, ensuring that data integrity is maintained across complex operations involving multiple steps or queries.

Negative Consequences
1. Implementing the DAL requires a considerable overhaul of the existing database access code, demanding significant development effort and potentially introducing temporary disruptions.
2. The architectural change increases the overall complexity of the codebase, with more layers and components to manage.

Neutral Consequences
1. The team will undergo a learning phase, particularly in adapting to the DAL's implementation. However, given the team's familiarity with tRPC and the existing architectural components, this transition is expected to be manageable.

## References
This decision was prompted by internal discussions and a strategic directive from our software architect, focusing on long-term maintainability and scalability. While specific external documents did not directly influence this decision, it aligns with industry best practices for software architecture and database management.
