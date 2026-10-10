import { createFileRoute } from "@tanstack/react-router";
import { CosplayApp } from "@/components/cosplay-app";

export const Route = createFileRoute("/")({ component: CosplayApp });
