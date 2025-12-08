 /*import type { Project } from "@/domain/types";

export const mockProject: Project = {
    id: "demo-forest",
    title: "La senda del bosque",
    nodes: [
        {
            id: "n1",
            title: "Entrada al bosque",
            text: "Te detienes frente a la entrada de un bosque antiguo.\n" +
                "Los árboles se alzan altos y oscuros, y un sendero serpentea hacia el interior.",
            hotspots: [
                {
                    id: "hs_n1_go_left",
                    actions: [ { type: "goToNode", targetNodeId: "n2"} ],
                },
                {
                    id: "hs_n1_go_right",
                    actions: [ { type: "goToNode", targetNodeId: "n3" } ],
                },
            ],
            isStart: true, 
            isFinal: false,
        },
        {
            id: "n2",
            title: "Sendero sombrío",
            text:"Avanzas por un sendero estrecho. El silencio es casi absoluto, " +
                "solo roto por el crujido de las ramas bajo tus pies.",
            hotspots: [
                {
                    id: "hs_n2_back_entry",
                    actions: [ { type: "goToNode", targetNodeId: "n1" } ],
                },
                {
                    id: "hs_n2_to_clearing",
                    actions: [ { type: "goToNode", targetNodeId: "n3" } ],
                },
            ],
        },
        {
            id: "n3",
            title: "Claro iluminado",
            text: "El bosque se abre en un pequeño claro iluminado por la luz suave del atardecer.\n" +
            "Sientes que, de algún modo, has encontrado un lugar importante.",
            hotspots: [
                {
                    id: "hs_n3_back_entry",
                    actions: [ { type: "goToNode", targetNodeId: "n1" } ],
                },
            ],
            isFinal: true,
        },
    ],
};*/
