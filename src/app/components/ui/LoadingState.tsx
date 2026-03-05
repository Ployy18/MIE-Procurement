import React from "react";
import { Loader2 } from "lucide-react";

export function LoadingState() {
    return (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <div className="text-gray-500 font-medium">Loading...</div>
        </div>
    );
}
