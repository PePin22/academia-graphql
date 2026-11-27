import { ObjectId } from "mongodb";
import { getAlumnosCollection, getAsignaturasCollection } from "../config/db";
import type {
    AlumnoT, AlumnoInput, AlumnoUpdateInput,
    AsignaturaT, AsignaturaInput, AsignaturaUpdateInput
} from "../models/types";

const convertirId = (id: string) => {
    if (!ObjectId.isValid(id)) throw new Error("El ID no es válido");
    return new ObjectId(id);
};

const convertirLista = (ids: string[] | null | undefined) => {
    const resultado: ObjectId[] = [];
    for (const id of ids ?? []) {
        const valor = convertirId(id);
        if (!resultado.find(actual => String(actual) === String(valor))) resultado.push(valor);
    }
    return resultado;
};

const comprobarAsignaturas = async (ids: ObjectId[]) => {
    const asignaturas = await getAsignaturasCollection().find({ _id: { $in: ids } }).toArray();
    if (asignaturas.length !== ids.length) throw new Error("Alguna asignatura no existe");
};

const comprobarAlumnos = async (ids: ObjectId[]) => {
    const alumnos = await getAlumnosCollection().find({ _id: { $in: ids } }).toArray();
    if (alumnos.length !== ids.length) throw new Error("Algún alumno no existe");
};

const alumnosPorAsignatura = (id: ObjectId) =>
    getAlumnosCollection().find({ asignaturas: id }).toArray();

const asignaturasPorAlumno = (alumno: AlumnoT) =>
    getAsignaturasCollection().find({ _id: { $in: alumno.asignaturas } }).toArray();

const cambiarMatricula = async (alumnoId: ObjectId, asignaturaId: ObjectId, matricular: boolean) => {
    const collection = getAlumnosCollection();
    while (true) {
        const alumno = await collection.findOne({ _id: alumnoId });
        if (!alumno) throw new Error("El alumno no existe");
        const coincide = (id: ObjectId) => String(id) === String(asignaturaId);
        const existe = alumno.asignaturas.find(coincide);
        if ((matricular && existe) || (!matricular && !existe)) return alumno;

        const asignaturas = matricular
            ? [...alumno.asignaturas, asignaturaId]
            : alumno.asignaturas.filter(id => !coincide(id));
        const actualizado = await collection.findOneAndUpdate(
            { _id: alumnoId, asignaturas: alumno.asignaturas },
            { $set: { asignaturas } },
            { returnDocument: "after" }
        );
        if (actualizado) return actualizado;
    }
};

const reemplazarAlumnos = async (asignaturaId: ObjectId, ids: ObjectId[]) => {
    const anteriores = await alumnosPorAsignatura(asignaturaId);
    for (const alumno of anteriores) {
        if (!ids.find(id => String(id) === String(alumno._id))) {
            await cambiarMatricula(alumno._id, asignaturaId, false);
        }
    }
    for (const id of ids) await cambiarMatricula(id, asignaturaId, true);
};

type PorId = { id: string };
type Matricula = { alumnoId: string; asignaturaId: string };

export const resolvers = {
    Query: {
        alumnos: () => getAlumnosCollection().find().toArray(),
        alumno: (_: unknown, args: PorId) =>
            getAlumnosCollection().findOne({ _id: convertirId(args.id) }),
        alumnosPorEdad: (_: unknown, args: { edad: number }) =>
            getAlumnosCollection().find({ edad: args.edad }).toArray(),
        asignaturas: () => getAsignaturasCollection().find().toArray(),
        asignatura: (_: unknown, args: PorId) =>
            getAsignaturasCollection().findOne({ _id: convertirId(args.id) }),
        asignaturasPorCurso: (_: unknown, args: { curso: number }) =>
            getAsignaturasCollection().find({ curso: args.curso }).toArray(),
        alumnosPorAsignatura: (_: unknown, args: { asignaturaId: string }) =>
            alumnosPorAsignatura(convertirId(args.asignaturaId)),
        asignaturasPorAlumno: async (_: unknown, args: { alumnoId: string }) => {
            const alumno = await getAlumnosCollection().findOne({ _id: convertirId(args.alumnoId) });
            return alumno ? asignaturasPorAlumno(alumno) : [];
        }
    },
    Mutation: {
        crearAlumno: async (_: unknown, args: { input: AlumnoInput }) => {
            const asignaturas = convertirLista(args.input.asignaturas);
            await comprobarAsignaturas(asignaturas);
            const alumno = { ...args.input, asignaturas };
            const resultado = await getAlumnosCollection().insertOne(alumno);
            return { ...alumno, _id: resultado.insertedId };
        },
        actualizarAlumno: async (_: unknown, args: PorId & { input: AlumnoUpdateInput }) => {
            const { nombre, edad, email, asignaturas } = args.input;
            if (nombre === null || edad === null || email === null) {
                throw new Error("Nombre, edad y email no admiten null");
            }
            const cambios: { nombre?: string; edad?: number; email?: string; asignaturas?: ObjectId[] } = {};
            if (nombre !== undefined) cambios.nombre = nombre;
            if (edad !== undefined) cambios.edad = edad;
            if (email !== undefined) cambios.email = email;
            if (asignaturas !== undefined) {
                cambios.asignaturas = convertirLista(asignaturas);
                await comprobarAsignaturas(cambios.asignaturas);
            }
            return getAlumnosCollection().findOneAndUpdate(
                { _id: convertirId(args.id) }, { $set: cambios }, { returnDocument: "after" }
            );
        },
        eliminarAlumno: (_: unknown, args: PorId) =>
            getAlumnosCollection().findOneAndDelete({ _id: convertirId(args.id) }),
        crearAsignatura: async (_: unknown, args: { input: AsignaturaInput }) => {
            const { alumnos, nombre, creditos, curso } = args.input;
            const ids = convertirLista(alumnos);
            await comprobarAlumnos(ids);
            const asignatura = { nombre, creditos, curso };
            const resultado = await getAsignaturasCollection().insertOne(asignatura);
            await reemplazarAlumnos(resultado.insertedId, ids);
            return { ...asignatura, _id: resultado.insertedId };
        },
        actualizarAsignatura: async (_: unknown, args: PorId & { input: AsignaturaUpdateInput }) => {
            const id = convertirId(args.id);
            const { nombre, creditos, curso, alumnos } = args.input;
            if (nombre === null || creditos === null || curso === null) {
                throw new Error("Nombre, créditos y curso no admiten null");
            }
            const cambios: { nombre?: string; creditos?: number; curso?: number } = {};
            if (nombre !== undefined) cambios.nombre = nombre;
            if (creditos !== undefined) cambios.creditos = creditos;
            if (curso !== undefined) cambios.curso = curso;
            const ids = convertirLista(alumnos);
            if (alumnos !== undefined) await comprobarAlumnos(ids);
            const asignatura = await getAsignaturasCollection().findOneAndUpdate(
                { _id: id }, { $set: cambios }, { returnDocument: "after" }
            );
            if (asignatura && alumnos !== undefined) await reemplazarAlumnos(id, ids);
            return asignatura;
        },
        eliminarAsignatura: async (_: unknown, args: PorId) => {
            const id = convertirId(args.id);
            const asignatura = await getAsignaturasCollection().findOneAndDelete({ _id: id });
            if (asignatura) await reemplazarAlumnos(id, []);
            return asignatura;
        },
        matricularAlumno: async (_: unknown, args: Matricula) => {
            const asignaturaId = convertirId(args.asignaturaId);
            await comprobarAsignaturas([asignaturaId]);
            return cambiarMatricula(convertirId(args.alumnoId), asignaturaId, true);
        },
        desmatricularAlumno: async (_: unknown, args: Matricula) => {
            const asignaturaId = convertirId(args.asignaturaId);
            await comprobarAsignaturas([asignaturaId]);
            return cambiarMatricula(convertirId(args.alumnoId), asignaturaId, false);
        }
    },
    AlumnoT: {
        asignaturas: (parent: AlumnoT) => asignaturasPorAlumno(parent)
    },
    AsignaturaT: {
        alumnos: (parent: AsignaturaT & { _id: ObjectId }) => alumnosPorAsignatura(parent._id)
    }
};
