import { Collection, MongoClient } from "mongodb";
import type { AlumnoT, AsignaturaT } from "../models/types";

const client = new MongoClient(process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017");

let alumnosCollection: Collection<AlumnoT>;
let asignaturasCollection: Collection<AsignaturaT>;

export const connectDB = async () => {
    await client.connect();
    const db = client.db("academia");
    alumnosCollection = db.collection<AlumnoT>("alumnos");
    asignaturasCollection = db.collection<AsignaturaT>("asignaturas");
};

export const getAlumnosCollection = () => alumnosCollection;
export const getAsignaturasCollection = () => asignaturasCollection;
