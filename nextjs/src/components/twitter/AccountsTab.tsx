import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/utils/api";
import { Trash2 } from "lucide-react";
import { useState } from "react";

// Component
export const AccountsTab = () => {
  // Hooks
  const { toast } = useToast();

  // State
  const [username, setUsername] = useState("");
  const [accountToDelete, setAccountToDelete] = useState<number | null>(null);

  // Queries
  const {
    data: accounts,
    isLoading: isLoadingAccounts,
    refetch,
  } = api.admin.twitter.list.useQuery();

  // Mutations
  const addAccount = api.admin.twitter.addAccount.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Account added successfully",
      });
      setUsername("");
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAccount = api.admin.twitter.delete.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Account deleted successfully",
      });
      setAccountToDelete(null);
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleAddAccount = () => {
    if (!username.trim()) return;
    addAccount.mutate({ username: username.trim() });
  };

  const handleDeleteAccount = (id: number) => {
    deleteAccount.mutate({ id });
  };

  // Format number with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Add Account Form */}
      <div className="flex gap-4">
        <Input
          placeholder="Enter Twitter username..."
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddAccount();
            }
          }}
          className="flex-1"
        />
        <Button
          onClick={handleAddAccount}
          disabled={addAccount.isLoading || !username.trim()}
        >
          {addAccount.isLoading ? "Adding..." : "Add Account"}
        </Button>
      </div>

      {/* Accounts Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Avatar</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Display Name</TableHead>
              <TableHead>Followers</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts?.map((account) => (
              <TableRow key={account.id}>
                <TableCell>
                  {account.profile_image_url ? (
                    <div className="relative h-10 w-10 overflow-hidden rounded-full">
                      <img
                        src={account.profile_image_url}
                        alt={account.username}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted" />
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {account.username}
                </TableCell>
                <TableCell>{account.display_name ?? "-"}</TableCell>
                <TableCell>{formatNumber(account.followers_count ?? 0)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setAccountToDelete(account.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoadingAccounts && (!accounts || accounts.length === 0) && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No accounts found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!accountToDelete}
        onOpenChange={() => setAccountToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this Twitter account. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                accountToDelete !== null && handleDeleteAccount(accountToDelete)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
