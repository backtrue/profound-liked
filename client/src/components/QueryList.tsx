import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Sparkles, FileText } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface QueryListProps {
    seedKeywordId: number;
}

export function QueryList({ seedKeywordId }: QueryListProps) {
    const [isOpen, setIsOpen] = useState(false);

    const { data: queries, isLoading } = trpc.queryGeneration.listBySeedKeyword.useQuery(
        { seedKeywordId },
        { enabled: isOpen }
    );

    if (isLoading && isOpen) {
        return (
            <div className="text-sm text-muted-foreground">載入中...</div>
        );
    }

    const templateQueries = queries?.filter(q => q.generationType === 'template') || [];
    const aiQueries = queries?.filter(q => q.generationType === 'ai_creative') || [];

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="text-sm">
                        {isOpen ? "隱藏問句列表" : "查看問句列表"}
                    </span>
                    {isOpen ? (
                        <ChevronUp className="h-4 w-4" />
                    ) : (
                        <ChevronDown className="h-4 w-4" />
                    )}
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4">
                {/* Template Queries */}
                {templateQueries.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <h4 className="text-sm font-medium">模板問句 ({templateQueries.length})</h4>
                        </div>
                        <div className="space-y-1 pl-6">
                            {templateQueries.map((query) => (
                                <div
                                    key={query.id}
                                    className="text-sm text-muted-foreground py-1 border-l-2 border-muted pl-3"
                                >
                                    {query.queryText}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* AI Creative Queries */}
                {aiQueries.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-purple-500" />
                            <h4 className="text-sm font-medium">AI 創意問句 ({aiQueries.length})</h4>
                            <Badge variant="secondary" className="text-xs">
                                AI
                            </Badge>
                        </div>
                        <div className="space-y-1 pl-6">
                            {aiQueries.map((query) => (
                                <div
                                    key={query.id}
                                    className="text-sm text-muted-foreground py-1 border-l-2 border-purple-200 pl-3"
                                >
                                    {query.queryText}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {queries && queries.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                        尚無問句
                    </div>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
}
