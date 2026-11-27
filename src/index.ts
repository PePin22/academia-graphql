import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { connectDB } from "./config/db";
import { typeDefs } from "./schema";
import { resolvers } from "./resolvers";

const server = new ApolloServer({ typeDefs, resolvers });

const startServer = async () => {
    await connectDB();
    const { url } = await startStandaloneServer(server, {
        listen: { port: 3000 }
    });
    console.log(`Servidor furulando en ${url}`);
};

startServer();
