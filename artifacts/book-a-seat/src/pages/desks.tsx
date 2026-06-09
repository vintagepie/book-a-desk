import { useListDesks } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function Desks() {
  const [, setLocation] = useLocation();
  const { data: desks, isLoading } = useListDesks();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Desks</h1>
        <Button onClick={() => setLocation("/desks/book")}>Book a Desk</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {desks?.map(desk => (
          <Card key={desk.id}>
            <CardHeader>
              <CardTitle>{desk.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Floor: {desk.floor}</p>
              <p>Zone: {desk.zone}</p>
              <p>Status: {desk.status}</p>
              {desk.status === 'available' && (
                <Button className="mt-4 w-full" onClick={() => setLocation(`/desks/book?deskId=${desk.id}`)}>Book</Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}