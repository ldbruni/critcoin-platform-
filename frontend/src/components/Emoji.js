// src/components/Emoji.js
import React from 'react';

const Emoji = ({ 
  name, 
  emoji, 
  alt, 
  size = '1.2em', 
  className = 'emoji',
  fallbackToUnicode = true,
  ...props 
}) => {
  const [imageError, setImageError] = React.useState(false);
  
  const imagePath = `/images/emojis/${name}.png`;
  
  // If we want to use custom PNGs but fallback to unicode emojis
  if (fallbackToUnicode && imageError) {
    return <span style={{ fontSize: size }} {...props}>{emoji}</span>;
  }
  
  // If custom PNG is available and no error
  if (!imageError) {
    return (
      <img
        src={imagePath}
        alt={alt || name || emoji}
        className={className}
        style={{ 
          width: size, 
          height: size, 
          display: 'inline',
          verticalAlign: 'middle',
          ...props.style
        }}
        onError={() => setImageError(true)}
        {...props}
      />
    );
  }
  
  // Fallback if no unicode provided
  return <span style={{ fontSize: size }}>{emoji || '?'}</span>;
};

export default Emoji;

// Pre-defined emoji mappings for easy use
export const EmojiMap = {
  profile: { name: 'profile', emoji: '🪪' },
  forum: { name: 'forum', emoji: '💬' },
  bounties: { name: 'bounties', emoji: '🎯' },
  admin: { name: 'admin', emoji: '🛡️' },
  community: { name: 'community', emoji: '👥' },
  dashboard: { name: 'dashboard', emoji: '📊' },
  upvote: { name: 'upvote', emoji: '⬆️' },
  downvote: { name: 'downvote', emoji: '⬇️' },
  user: { name: 'user', emoji: '👤' },
  warning: { name: 'warning', emoji: '⚠️' },
  success: { name: 'success', emoji: '✅' },
  error: { name: 'error', emoji: '❌' },
  launch: { name: 'launch', emoji: '🚀' }
};

// Convenience components
export const ProfileEmoji = (props) => <Emoji {...EmojiMap.profile} {...props} />;
export const ForumEmoji = (props) => <Emoji {...EmojiMap.forum} {...props} />;
export const UpvoteEmoji = (props) => <Emoji {...EmojiMap.upvote} {...props} />;
export const DownvoteEmoji = (props) => <Emoji {...EmojiMap.downvote} {...props} />;