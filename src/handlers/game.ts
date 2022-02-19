import { Context } from "grammy";
import { getFormatedDuration } from "../helpers/date";
import { wordExists } from "../helpers/dictionary";
import { guessPrompt, resultGrid } from "../helpers/utils";
import WordleDB from "../services/db";

export default async function guessHandler(ctx: Context) {
    
    const user = await WordleDB.getUser(ctx.from.id, ctx.from.first_name);
    const game = await WordleDB.getToday();
    
    if (!game || !user) {
        return ctx.reply("Something went wrong. Please try again later.");
    }
    
    const guess = ctx.message.text.toLowerCase().split('');

    if (guess.length != 5) {
        return ctx.reply(`Your guess must be 5 letters long!`);
    }
    
    if (guess.some(letter => !/[a-z]/.test(letter))) {
        return ctx.reply(`Your guess must be only letters!`);
    }

    if (!await wordExists(guess.join(''))) {
        return ctx.reply(`Please enter a valid word!`);
    }
    
    // Just don't mind if the user is not currently playing the game.
    if (!user.onGame) {
        console.log("User is not on game");
        return
    }
    const result = getBoxes(game.word, guess);

    user.tries.push(ctx.message.text);
    if (game.word == guess.join('')) {
        user.onGame = false;
        user.lastGame = game.id;
        if (user.tries.length === 1) {
            await ctx.reply(`Awesome! Just in one try! Nailed it! 🎉`);
        }

        await sendShareMessage(ctx, game.word, user.tries, game.id);

        await ctx.reply(`You guessed the word!\n\nThe word was <b>${game.word.toUpperCase()}</b>! 🚀`, {
            parse_mode: "HTML"
        });
        await ctx.reply(`Come back after ${getFormatedDuration(game.next)} for the next word!`);
        user.tries = [];
    } else if (user.tries.length >= 6) {
        user.onGame = false;
        user.lastGame = game.id;
        await sendShareMessage(ctx, game.word, user.tries, game.id);
        await ctx.reply(`You lost! The word was <b>${game.word.toUpperCase()}</b>! 💀`, {
            parse_mode: "HTML"
        });
        await ctx.reply(`Come back after ${getFormatedDuration(game.next)} for the next word!`);
        user.tries = [];
    } else {
        await ctx.reply(`${result.join(' ')}`);
        await ctx.reply(guessPrompt(user.tries.length + 1));
    }
    await WordleDB.updateUser(user);
}

export function getBoxes(word: string, guess: string[]): string[] {
    let letters: (string | null)[] = word.split('');
    const boxes: (string | null)[] = [null, null, null, null, null];

    // First mark all correct letters
    guess.forEach((guessLetter, index) => {
        if (letters[index] == guessLetter) {
            boxes[index] = "🟩";
            letters[index] = null;
        }
    });

    // Then mark all wrong letters
    guess.forEach((guessLetter, index) => {
        if (!boxes[index] && !letters.includes(guessLetter)) {
            boxes[index] = "⬛️";
        }
    });

    // Finally mark all the letters which are in the word but not in the correct position
    letters.forEach((letter, index) => {
        if (!boxes[index] && letters.includes(letter)) {
            boxes[index] = "🟨";
            letters[index] = null;
        }
    });

    return boxes;
}


const sendShareMessage = async (ctx: Context, word: string, tries: string[], gameId: number) => {
    const grid = resultGrid(word, tries);
    const resultMessage = `#WordleBot ${gameId} - ${tries.length} / 6\n\n${grid.join('\n')}\n\n@xWordleBot`;
    await ctx.reply(`<code>${resultMessage}</code>`, {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{
                    text: "Share 📩",
                    url: `https://t.me/share/text?url=https://t.me/xwordlebot&text=%0A${encodeURI(resultMessage)}`
                }],
            ],
        }
    });
}