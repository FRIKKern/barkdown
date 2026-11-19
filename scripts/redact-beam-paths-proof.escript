#!/usr/bin/env escript
%% escript scripts/redact-beam-paths-proof.escript OLD.beam NEW.beam [OLD NEW ...]
%%
%% Proof for scripts/redact-beam-paths.mjs. For each pair:
%% - the chunk set and order are the same;
%% - every chunk of NEW decodes: beam_lib reads atoms, exports, imports, attributes and compile_info, and every term
%%   chunk (and each LitT literal) decodes with binary_to_term;
%% - term by term, OLD and NEW are equal except leaves (strings, binaries, atoms) where NEW is exactly OLD with the
%%   user folder of a local path replaced by <user>; non-term chunks are byte-equal, except Line file names, which
%%   are compared the same way;
%% - NEW loads into a fresh VM with code:load_binary (the module is purged again afterwards).
%% Prints the counts of terms compared and replacements per pair, and a total. Exits 1 on any failure.
-mode(compile).

neutral() -> "(?:RUNNER~1|RUNNER~2|RUNNER|runneradmin|me|PS|<user>|Public|Default|All Users|Shared)".
swap(Bin) ->
    W = "([A-Za-z]:(?:\\\\+|/+)Users(?:\\\\+|/+))(?!" ++ neutral() ++ "(?:[\\\\/\"'\\s]|$))([^\\\\/\"'\\s<>]+)",
    M = "((?<![A-Za-z0-9.])/Users/)(?!" ++ neutral() ++ "/)([^/\"'\\s<>\\x00-\\x1f]+)(?=/)",
    re:replace(re:replace(Bin, W, "\\1<user>", [global, caseless, {return, binary}]), M, "\\1<user>", [global, {return, binary}]).

main(Args) when length(Args) >= 2, length(Args) rem 2 =:= 0 ->
    {T, R, Bad} = lists:foldl(fun({Old, New}, {T0, R0, B0}) ->
        try
            {T1, R1} = pair(Old, New),
            io:format("~s: ~p terms compared, ~p replacements, loads, all chunks decode~n", [New, T1, R1]),
            {T0 + T1, R0 + R1, B0}
        catch throw:Why -> io:format("FAIL ~s: ~p~n", [New, Why]), {T0, R0, B0 + 1}
        end
    end, {0, 0, 0}, pairs(Args)),
    io:format("total: ~p terms compared, ~p replacements, ~p failure(s)~n", [T, R, Bad]),
    halt(min(Bad, 1));
main(_) -> io:format("usage: OLD.beam NEW.beam [OLD NEW ...]~n"), halt(2).

pairs([A, B | Rest]) -> [{A, B} | pairs(Rest)];
pairs([]) -> [].

pair(OldF, NewF) ->
    {ok, Old} = file:read_file(OldF), {ok, New} = file:read_file(NewF),
    {ok, Mod, CO} = beam_lib:all_chunks(Old),
    {ok, Mod, CN} = beam_lib:all_chunks(New),
    [I || {I, _} <- CO] =:= [I || {I, _} <- CN] orelse throw(chunk_set_or_order_changed),
    {ok, {Mod, _}} = beam_lib:chunks(New, [atoms, exports, imports, attributes, compile_info]),
    Count = lists:foldl(fun({{Id, A}, {Id, B}}, {T, R}) ->
        {T1, R1} = chunk(Id, A, B), {T + T1, R + R1}
    end, {0, 0}, lists:zip(CO, CN)),
    code:purge(Mod), code:delete(Mod), code:purge(Mod),
    case code:load_binary(Mod, NewF, New) of
        {module, Mod} -> code:purge(Mod), code:delete(Mod), code:purge(Mod);
        Err -> throw({load, Err})
    end,
    Count.

chunk("LitT", <<0:32, N:32, A/binary>>, <<0:32, N:32, B/binary>>) ->
    lists:foldl(fun({X, Y}, {T, R}) -> {T1, R1} = cmp(binary_to_term(X), binary_to_term(Y)), {T + T1, R + R1} end,
                {0, 0}, lists:zip(lits(N, A), lits(N, B)));
chunk("LitT", <<S:32, A/binary>>, <<S2:32, B/binary>>) when S > 0, S2 > 0 ->
    PA = zlib:uncompress(A), PB = zlib:uncompress(B),
    <<NA:32, RA/binary>> = PA, <<NB:32, RB/binary>> = PB, NA =:= NB orelse throw(literal_count),
    chunk("LitT", <<0:32, NA:32, RA/binary>>, <<0:32, NB:32, RB/binary>>);
chunk("Line", A, B) -> line(A, B);
chunk(Id, <<131, _/binary>> = A, B) ->
    TA = binary_to_term(A), TB = try binary_to_term(B) catch _:_ -> throw({does_not_decode, Id}) end,
    cmp(TA, TB);
chunk(_, A, A) -> {1, 0};
chunk(Id, _, _) -> throw({raw_chunk_changed, Id}).

lits(0, <<>>) -> [];
lits(N, <<S:32, T:S/binary, Rest/binary>>) -> [T | lits(N - 1, Rest)].

%% Line: everything before the file-name table is byte-equal; names compare as leaves.
%% The header's fifth word is the number of file names; the table starts at the offset from which exactly that many
%% <<Len:16, Name:Len>> entries end at the end of the chunk.
line(A, A) -> {1, 0};
line(A, B) ->
    XA = table_at(A), XB = table_at(B),
    XA =:= XB orelse throw(line_items_moved),
    binary:part(A, 0, XA) =:= binary:part(B, 0, XB) orelse throw(line_items_changed),
    names(binary:part(A, XA, byte_size(A) - XA), binary:part(B, XB, byte_size(B) - XB), {1, 0}).
table_at(<<_:4/binary, _:4/binary, _:4/binary, _:4/binary, N:32, _/binary>> = D) ->
    case [X || X <- lists:seq(20, byte_size(D)), entries(binary:part(D, X, byte_size(D) - X)) =:= N] of
        [X | _] -> X;
        [] -> throw(line_table_not_found)
    end.
entries(<<>>) -> 0;
entries(<<L:16, _:L/binary, Rest/binary>>) -> case entries(Rest) of E when is_integer(E) -> E + 1; E -> E end;
entries(_) -> bad.
names(<<LA:16, NA:LA/binary, RA/binary>>, <<LB:16, NB:LB/binary, RB/binary>>, {T, R}) ->
    {T1, R1} = leaf(NA, NB), names(RA, RB, {T + T1, R + R1});
names(<<>>, <<>>, Acc) -> Acc;
names(_, _, _) -> throw(line_names_differ).

leaf(A, A) -> {1, 0};
leaf(A, B) -> case swap(A) =:= B of true -> {1, 1}; false -> throw({changed_beyond_folder, {expected, swap(A)}, {found, B}}) end.

cmp(A, A) -> {count(A), 0};
cmp(A, B) when is_binary(A), is_binary(B) -> leaf(A, B);
cmp(A, B) when is_atom(A), is_atom(B) -> leaf(atom_to_binary(A, utf8), atom_to_binary(B, utf8));
cmp(A, B) when is_list(A), is_list(B) ->
    case io_lib:printable_unicode_list(A) andalso io_lib:printable_unicode_list(B) of
        true -> leaf(unicode:characters_to_binary(A), unicode:characters_to_binary(B));
        false -> cmp_list(A, B, {1, 0})
    end;
cmp(A, B) when is_tuple(A), is_tuple(B), tuple_size(A) =:= tuple_size(B) -> cmp_list(tuple_to_list(A), tuple_to_list(B), {1, 0});
cmp(A, B) when is_map(A), is_map(B), map_size(A) =:= map_size(B) ->
    %% keys are compared through the sorted key lists; a swapped key would show as a key mismatch
    cmp_list(lists:sort(maps:to_list(A)), lists:sort(maps:to_list(B)), {1, 0});
cmp(A, B) -> throw({term_shape_changed, A, B}).

cmp_list([X | XS], [Y | YS], {T, R}) -> {T1, R1} = cmp(X, Y), cmp_list(XS, YS, {T + T1, R + R1});
cmp_list([], [], Acc) -> Acc;
cmp_list(X, Y, {T, R}) when not is_list(X), not is_list(Y) -> {T1, R1} = cmp(X, Y), {T + T1, R + R1};
cmp_list(_, _, _) -> throw(list_length_changed).

count(T) when is_tuple(T) -> 1 + lists:sum([count(E) || E <- tuple_to_list(T)]);
count(M) when is_map(M) -> 1 + lists:sum([count(K) + count(V) || {K, V} <- maps:to_list(M)]);
count([H | T]) -> count(H) + count(T);
count(_) -> 1.
