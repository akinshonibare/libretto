import { followAction, unfollowAction } from "@/app/actions/community";
import { Button } from "@/components/ui/button";

export function FollowButton({
  targetUserId,
  targetHandle,
  isFollowing,
  isSelf,
}: {
  targetUserId: string;
  targetHandle: string;
  isFollowing: boolean;
  isSelf: boolean;
}) {
  if (isSelf) return null;

  return (
    <form action={isFollowing ? unfollowAction : followAction}>
      <input type="hidden" name="targetUserId" value={targetUserId} />
      <input type="hidden" name="targetHandle" value={targetHandle} />
      <Button type="submit" size="sm" variant={isFollowing ? "outline" : "default"}>
        {isFollowing ? "Following" : "Follow"}
      </Button>
    </form>
  );
}
