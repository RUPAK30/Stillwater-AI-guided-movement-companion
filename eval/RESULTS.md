# Understanding eval

Run 2026-10-11. 44 realistic phrasings: 14 body concerns, 4 figures of speech, and ordinary needs and mid-session requests.

| | Pass | Missed body concern | False alarm |
|---|---|---|---|
| Keyword layer | 14/44 | 10/14 | 0 |
| Claude (claude plan default via Claude plan CLI) + keyword floor | 44/44 | 0/14 | 0 |

Median latency per message: 6862 ms.

| Case | Message | Expected | Keyword | Claude |
|---|---|---|---|---|
| s01 | my chest feels kind of tight when I breathe | urgent | **missed urgent** | pass |
| s02 | I nearly blacked out standing up earlier | urgent | pass | pass |
| s03 | left arm's gone tingly and weak | urgent | **missed urgent** | pass |
| s04 | ugh my knee feels weird today | pain | **missed pain** | pass |
| s05 | something twinged in my lower back this morning | pain | **missed pain** | pass |
| s06 | still sore from tweaking my ankle on saturday | pain | **missed pain** | pass |
| s07 | head's a bit spinny but I want to move | pain | **missed pain** | pass |
| s08 | just got the all clear after my acl op, easing back in | rehab | **missed rehab** | pass |
| s09 | my physio said no twisting for now | rehab | pass | pass |
| s10 | wrist has been clicking and aching all week | pain | **missed pain** | pass |
| f01 | pain in the neck kind of day at work, need to unwind | stretching/mobility | pass | pass |
| f02 | my legs are dead from sitting in meetings | mobility/stretching | pass | pass |
| f03 | killing it this week, want something lively | cardio | **no suggestion** | pass |
| f04 | this commute is a headache, need to shake it off | cardio/mobility | pass | pass |
| n01 | been hunched over a laptop since 8am | mobility | pass | pass |
| n02 | feel like a rusty hinge | mobility | **no suggestion** | pass |
| n03 | hamstrings are like guitar strings | stretching | **no suggestion** | pass |
| n04 | zero motivation tbh, just want something easy | stretching/mobility | **no suggestion** | pass |
| n05 | got about 3 mins before my next call | mobility/stretching/cardio | pass | pass |
| n06 | too much coffee, I'm buzzing | cardio | **no suggestion** | pass |
| n07 | brain is fried, I need quiet | stretching | pass | pass |
| n08 | idk, you pick | mobility/stretching | pass | pass |
| n09 | want to get my heart going a bit | cardio | **no suggestion** | pass |
| n10 | I'd like to lose some weight | cardio | **no suggestion** | pass |
| n11 | can we do some burpees and box jumps | cardio | **no suggestion** | pass |
| n12 | anxious before a big presentation | stretching/mobility | **no suggestion** | pass |
| n13 | stuck on a long flight tomorrow, want to loosen up today | mobility/stretching | pass | pass |
| n14 | feeling great, give me the proper one | mobility/stretching/cardio | **no suggestion** | pass |
| n15 | shoulders up by my ears all day | mobility/stretching | **no suggestion** | pass |
| x01 | felt a bit lightheaded on that one | pain | pass | pass |
| x02 | ooh that pinched | pain | **missed pain** | pass |
| x03 | my heart is racing weirdly and I feel faint | urgent | pass | pass |
| x04 | my wrists are tired | tip/easier | **request unclear** | pass |
| x05 | this is a bit boring, something livelier? | switch | **request unclear** | pass |
| x06 | barely broke a sweat | harder | **request unclear** | pass |
| x07 | phew that's a lot, can we dial it back | easier | **request unclear** | pass |
| x08 | gotta run, boss is calling | stop | **request unclear** | pass |
| x09 | ceiling's too low to reach up here | tip | **request unclear** | pass |
| x10 | can I do this sitting down? I'm on a train | tip | **request unclear** | pass |
| x11 | I'd rather stretch instead | switch | pass | pass |
| x12 | knees don't love this one | pain | **missed pain** | pass |
| x13 | this is easy peasy | harder | **request unclear** | pass |
| x14 | I'm done for today | stop | pass | pass |
| x15 | can I go slower on this? | tip/easier | **request unclear** | pass |
