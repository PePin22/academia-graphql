import type { ObjectId } from "mongodb";

export type AlumnoT = {
    _id?: ObjectId;
    nombre: string;
    edad: number;
    email: string;
    asignaturas: ObjectId[];
};

export type AsignaturaT = {
    _id?: ObjectId;
    nombre: string;
    creditos: number;
    curso: number;
};

export type AlumnoInput = {
    nombre: string;
    edad: number;
    email: string;
    asignaturas?: string[] | null;
};

export type AlumnoUpdateInput = {
    nombre?: string | null;
    edad?: number | null;
    email?: string | null;
    asignaturas?: string[] | null;
};

export type AsignaturaInput = {
    nombre: string;
    creditos: number;
    curso: number;
    alumnos?: string[] | null;
};

export type AsignaturaUpdateInput = {
    nombre?: string | null;
    creditos?: number | null;
    curso?: number | null;
    alumnos?: string[] | null;
};
